import { Effect, Option, Schema } from "effect"
import type { Paper, Frontier } from "@research-web/shared"
import { LlmService } from "../services/LlmService.js"
import { LlmError, ParseError } from "../errors.js"

const FrontierCluster = Schema.Struct({
  label: Schema.String,
  summary: Schema.String,
  paperIds: Schema.Array(Schema.String),
})

const FrontierClusters = Schema.Array(FrontierCluster)

const backfillEmptyFrontiers = (
  frontiers: Frontier[],
  papers: readonly Paper[]
): Frontier[] => {
  const emptyIndices = frontiers
    .map((f, i) => (f.paperIds.length === 0 ? i : -1))
    .filter((i) => i >= 0)
  if (emptyIndices.length === 0 || papers.length === 0) return frontiers

  const claimed = new Set(frontiers.flatMap((f) => f.paperIds))
  const unclaimed = papers.map((p) => p.id).filter((id) => !claimed.has(id))
  const pool = unclaimed.length > 0 ? unclaimed : papers.map((p) => p.id)
  const perCluster = Math.max(1, Math.ceil(pool.length / emptyIndices.length))

  return frontiers.map((f, i) => {
    const idx = emptyIndices.indexOf(i)
    if (idx < 0) return f
    const slice = pool.slice(idx * perCluster, (idx + 1) * perCluster)
    const ids = slice.length > 0 ? slice : [pool[idx % pool.length]]
    return { ...f, paperIds: ids }
  })
}

const systemPrompt = `You are a research analyst. Given a list of academic papers, cluster them into 4-6 research frontiers (thematic groups).

Return ONLY a JSON array with this structure:
[{ "label": "Frontier Name", "summary": "One sentence describing this research direction", "paperIds": ["id1", "id2"] }]

Every paper must appear in exactly one frontier. Be specific and descriptive with frontier labels.`

const formatPapers = (papers: readonly Paper[]): string =>
  papers
    .map(
      (p) =>
        `- ID: ${p.id} | Title: ${p.title} | Year: ${p.year} | Citations: ${p.citationCount}${Option.isSome(p.abstract) ? ` | Abstract: ${p.abstract.value}` : ""}`
    )
    .join("\n")

const extractJson = (text: string): string => {
  // Try code fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Try extracting a raw JSON array from surrounding prose
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0].trim()

  return text.trim()
}

export const clusterIntoFrontiers = (
  papers: readonly Paper[]
): Effect.Effect<Frontier[], LlmError | ParseError, LlmService> =>
  Effect.gen(function* () {
    const llm = yield* LlmService
    const userPrompt = `Cluster these ${papers.length} papers into research frontiers:\n\n${formatPapers(papers)}`

    const raw = yield* llm.complete(systemPrompt, userPrompt)
    const cleaned = extractJson(raw)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return yield* Effect.fail(
        new ParseError({ message: "Failed to parse LLM JSON response", raw: cleaned })
      )
    }

    const clusters = yield* Schema.decodeUnknown(FrontierClusters)(parsed).pipe(
      Effect.mapError(
        (e) => new ParseError({ message: `Schema validation failed: ${e.message}`, raw: parsed })
      )
    )

    const validIds = new Set(papers.map((p) => p.id))
    const mapped = clusters.map((c) => ({
      id: crypto.randomUUID(),
      label: c.label,
      summary: c.summary,
      paperIds: c.paperIds.filter((id) => validIds.has(id)),
      parentId: Option.none(),
    }))
    return backfillEmptyFrontiers(mapped, papers)
  }).pipe(
    Effect.retry({ times: 2, while: (e) => e._tag === "ParseError" })
  )

const subFrontierSystemPrompt = `You are a research analyst. Given a research frontier and a list of adjacent papers, identify 2-4 sub-frontiers representing where this field is heading.

Return ONLY a JSON array with this structure:
[{ "label": "Sub-Frontier Name", "summary": "One sentence describing this research direction", "paperIds": ["id1", "id2"] }]

Every paper must appear in exactly one sub-frontier. Be specific and descriptive with sub-frontier labels.`

export const identifySubFrontiers = (
  frontier: Frontier,
  papers: readonly Paper[]
): Effect.Effect<Frontier[], LlmError | ParseError, LlmService> =>
  Effect.gen(function* () {
    const llm = yield* LlmService
    const userPrompt = `Research frontier: "${frontier.label}"\nSummary: ${frontier.summary}\n\nIdentify sub-frontiers from these ${papers.length} adjacent papers:\n\n${formatPapers(papers)}`

    const raw = yield* llm.complete(subFrontierSystemPrompt, userPrompt)
    const cleaned = extractJson(raw)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return yield* Effect.fail(
        new ParseError({ message: "Failed to parse LLM JSON response", raw: cleaned })
      )
    }

    const clusters = yield* Schema.decodeUnknown(FrontierClusters)(parsed).pipe(
      Effect.mapError(
        (e) => new ParseError({ message: `Schema validation failed: ${e.message}`, raw: parsed })
      )
    )

    const validIds = new Set(papers.map((p) => p.id))
    const mapped = clusters.map((c) => ({
      id: crypto.randomUUID(),
      label: c.label,
      summary: c.summary,
      paperIds: c.paperIds.filter((id) => validIds.has(id)),
      parentId: Option.some(frontier.id),
    }))
    return backfillEmptyFrontiers(mapped, papers)
  }).pipe(
    Effect.retry({ times: 2, while: (e) => e._tag === "ParseError" })
  )
