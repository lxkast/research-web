import { Effect } from "effect"
import type { GraphNodeType } from "@research-web/shared"
import { SemanticScholarService } from "../services/SemanticScholarService.js"
import { ResearchGraphService } from "../services/ResearchGraphService.js"
import { WebSocketHubService } from "../services/WebSocketHubService.js"
import { LlmService } from "../services/LlmService.js"
import { discover } from "./FrontierDiscovery.js"
import { expand } from "./FrontierExpander.js"

export const startExploration = (
  sessionId: string,
  name: string
): Effect.Effect<
  void,
  never,
  SemanticScholarService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const s2 = yield* SemanticScholarService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    yield* graph.getOrCreateSession(sessionId)

    const researcher = yield* s2.searchAuthor(name)
    yield* graph.addResearcher(sessionId, researcher)

    const node: GraphNodeType = { type: "researcher", data: researcher }
    yield* hub.broadcast(sessionId, { type: "researcher_found", node })

    const fiber = yield* Effect.fork(discover(sessionId, researcher.id))
    yield* Effect.fromFiber(fiber)

    yield* hub.broadcast(sessionId, {
      type: "exploration_complete",
      explorationId: sessionId,
    })
  }).pipe(
    Effect.catchAll((e) =>
      Effect.gen(function* () {
        console.error("[Orchestrator] error:", e)
        const hub = yield* WebSocketHubService
        yield* hub.broadcast(sessionId, {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        })
      })
    )
  )

export const expandFrontier = (
  sessionId: string,
  frontierId: string
): Effect.Effect<
  void,
  never,
  SemanticScholarService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const hub = yield* WebSocketHubService

    const fiber = yield* Effect.fork(expand(sessionId, frontierId))
    yield* Effect.fromFiber(fiber)

    yield* hub.broadcast(sessionId, {
      type: "exploration_complete",
      explorationId: frontierId,
    })
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        console.error("[Orchestrator] expandFrontier error:", cause)
        const hub = yield* WebSocketHubService
        yield* hub.broadcast(sessionId, {
          type: "error",
          message: `Expand failed for frontier ${frontierId}`,
        })
      })
    )
  )
