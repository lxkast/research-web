import { Effect, Option } from "effect"
import type { Frontier, GraphNodeType, GraphEdgeType } from "@research-web/shared"
import { OpenAlexService } from "../services/OpenAlexService.js"
import { ResearchGraphService } from "../services/ResearchGraphService.js"
import { WebSocketHubService } from "../services/WebSocketHubService.js"
import { clusterIntoFrontiers } from "./Synthesizer.js"

export const discover = (
  sessionId: string,
  researcherId: string
): Effect.Effect<
  Frontier[],
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService | import("../services/LlmService.js").LlmService
> =>
  Effect.gen(function* () {
    const s2 = yield* OpenAlexService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    const papers = yield* s2.getAuthorPapers(researcherId)

    const topPapers = [...papers]
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 30)

    const frontiers = yield* clusterIntoFrontiers(topPapers)

    yield* graph.addFrontiers(sessionId, researcherId, frontiers)

    const nodes: GraphNodeType[] = frontiers.map((f) => ({
      type: "frontier" as const,
      data: f,
    }))

    const edges: GraphEdgeType[] = frontiers.map((f) => ({
      source: researcherId,
      target: f.id,
      type: "has_frontier" as const,
    }))

    yield* hub.broadcast(sessionId, {
      type: "frontiers_discovered",
      nodes,
      edges,
      parentId: Option.none(),
    })

    return frontiers
  }).pipe(Effect.catchAll((e) => {
    console.error("[FrontierDiscovery] error:", e)
    return Effect.succeed([] as Frontier[])
  }))
