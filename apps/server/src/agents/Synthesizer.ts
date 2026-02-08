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

const stripCodeFences = (text: string): string => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}

export const clusterIntoFrontiers = (
  papers: readonly Paper[]
): Effect.Effect<Frontier[], LlmError | ParseError, LlmService> =>
  Effect.gen(function* () {
    const llm = yield* LlmService
    const userPrompt = `Cluster these ${papers.length} papers into research frontiers:\n\n${formatPapers(papers)}`

    const raw = yield* llm.complete(systemPrompt, userPrompt)
    const cleaned = stripCodeFences(raw)

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

    return clusters.map((c) => ({
      id: crypto.randomUUID(),
      label: c.label,
      summary: c.summary,
      paperIds: [...c.paperIds],
      parentId: Option.none(),
    }))
  }).pipe(
    Effect.retry({ times: 2, while: (e) => e._tag === "ParseError" })
  )
