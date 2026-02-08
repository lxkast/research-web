import { Effect } from "effect"
import type { GraphNodeType, GraphEdgeType } from "@research-web/shared"
import { OpenAlexService } from "../services/OpenAlexService.js"
import { ResearchGraphService } from "../services/ResearchGraphService.js"
import { WebSocketHubService } from "../services/WebSocketHubService.js"

export const collect = (
  sessionId: string,
  frontierId: string
): Effect.Effect<
  void,
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService
> =>
  Effect.gen(function* () {
    const s2 = yield* OpenAlexService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    const frontier = yield* graph.getFrontier(sessionId, frontierId)

    const validIds = frontier.paperIds.filter((id) => id.trim() !== "")
    if (validIds.length === 0) {
      console.warn("[PaperCollector] no paper IDs for frontier", frontierId)
      return
    }

    console.log(`[PaperCollector] fetching ${validIds.length} papers:`, validIds.slice(0, 3), "...")

    const papers = yield* s2.batchGetPapers(validIds)

    const seen = new Set<string>()
    const contributors: Array<{ id: string; name: string }> = []
    for (const paper of papers) {
      for (const author of paper.authors) {
        if (!seen.has(author.id)) {
          seen.add(author.id)
          contributors.push({ id: author.id, name: author.name })
        }
      }
    }

    yield* graph.addPapers(sessionId, frontierId, papers)

    const nodes: GraphNodeType[] = [
      ...papers.map((p) => ({
        type: "paper" as const,
        data: p,
      })),
      ...contributors.map((c) => ({
        type: "contributor" as const,
        data: c,
      })),
    ]

    const edges: GraphEdgeType[] = [
      ...papers.map((p) => ({
        source: frontierId,
        target: p.id,
        type: "has_paper" as const,
      })),
      ...contributors.map((c) => ({
        source: frontierId,
        target: c.id,
        type: "has_contributor" as const,
      })),
    ]

    yield* hub.broadcast(sessionId, {
      type: "papers_collected",
      nodes,
      edges,
      frontierId,
    })
  }).pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        console.error("[PaperCollector] error:", e)
        const hub = yield* WebSocketHubService
        yield* hub.broadcast(sessionId, {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        })
      })
    )
  )
