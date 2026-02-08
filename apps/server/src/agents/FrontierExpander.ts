import { Effect, Option } from "effect"
import type { Paper, GraphNodeType, GraphEdgeType } from "@research-web/shared"
import { OpenAlexService } from "../services/OpenAlexService.js"
import { ResearchGraphService } from "../services/ResearchGraphService.js"
import { WebSocketHubService } from "../services/WebSocketHubService.js"
import { LlmService } from "../services/LlmService.js"
import { identifySubFrontiers } from "./Synthesizer.js"

export const expand = (
  sessionId: string,
  frontierId: string
): Effect.Effect<
  void,
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const s2 = yield* OpenAlexService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    const frontier = yield* graph.getFrontier(sessionId, frontierId)

    const allPapers = yield* Effect.forEach(
      frontier.paperIds,
      (paperId) =>
        Effect.all([
          s2.getCitations(paperId),
          s2.getReferences(paperId),
        ]).pipe(
          Effect.map(([citations, references]) => [...citations, ...references]),
          Effect.catchAll(() => Effect.succeed([] as Paper[]))
        ),
      { concurrency: 5 }
    )

    const seen = new Set<string>()
    const deduped: Paper[] = []
    for (const papers of allPapers) {
      for (const p of papers) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          deduped.push(p)
        }
      }
    }

    let topPapers = deduped
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 30)

    if (topPapers.length === 0) {
      const fallback = yield* s2.batchGetPapers(frontier.paperIds)
      topPapers = [...fallback]
    }

    const subFrontiers = yield* identifySubFrontiers(frontier, topPapers)

    yield* graph.addFrontiers(sessionId, frontierId, subFrontiers)

    const nodes: GraphNodeType[] = subFrontiers.map((f) => ({
      type: "frontier" as const,
      data: f,
    }))

    const edges: GraphEdgeType[] = subFrontiers.map((f) => ({
      source: frontierId,
      target: f.id,
      type: "has_subfrontier" as const,
    }))

    yield* hub.broadcast(sessionId, {
      type: "frontiers_discovered",
      nodes,
      edges,
      parentId: Option.some(frontierId),
    })
  }).pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        console.error("[FrontierExpander] error:", e)
        const hub = yield* WebSocketHubService
        yield* hub.broadcast(sessionId, {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        })
      })
    )
  )
