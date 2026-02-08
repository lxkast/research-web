import { Effect, Fiber } from "effect"
import type { GraphNodeType } from "@research-web/shared"
import { OpenAlexService } from "../services/OpenAlexService.js"
import { ResearchGraphService } from "../services/ResearchGraphService.js"
import { WebSocketHubService } from "../services/WebSocketHubService.js"
import { LlmService } from "../services/LlmService.js"
import { discover } from "./FrontierDiscovery.js"
import { expand } from "./FrontierExpander.js"
import { collect } from "./PaperCollector.js"

// --- Fiber tracking per session ---

const sessionFibers = new Map<string, Set<Fiber.RuntimeFiber<any, any>>>()

function trackFiber(sessionId: string, fiber: Fiber.RuntimeFiber<any, any>) {
  let fibers = sessionFibers.get(sessionId)
  if (!fibers) {
    fibers = new Set()
    sessionFibers.set(sessionId, fibers)
  }
  fibers.add(fiber)
  fiber.addObserver(() => {
    fibers!.delete(fiber)
    if (fibers!.size === 0) sessionFibers.delete(sessionId)
  })
}

export const cancelSession = (
  sessionId: string
): Effect.Effect<void, never, WebSocketHubService> =>
  Effect.gen(function* () {
    const fibers = sessionFibers.get(sessionId)
    if (fibers && fibers.size > 0) {
      yield* Fiber.interruptAll(fibers)
    }
    sessionFibers.delete(sessionId)
    const hub = yield* WebSocketHubService
    yield* hub.broadcast(sessionId, { type: "exploration_cancelled" })
  })

export const autoExpand = (
  sessionId: string,
  maxDepth: number
): Effect.Effect<
  void,
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    while (true) {
      const candidates = yield* graph.getUnexpandedFrontiers(sessionId, maxDepth)
      if (candidates.length === 0) break

      yield* Effect.forEach(
        candidates,
        ({ frontier }) =>
          Effect.gen(function* () {
            yield* hub.broadcast(sessionId, {
              type: "exploration_started",
              explorationId: frontier.id,
            })
            yield* expand(sessionId, frontier.id)
            yield* graph.markExpanded(sessionId, frontier.id)
            yield* hub.broadcast(sessionId, {
              type: "exploration_complete",
              explorationId: frontier.id,
            })
          }).pipe(
            Effect.catchAll((e) =>
              Effect.gen(function* () {
                console.error("[autoExpand] error expanding frontier:", frontier.id, e)
                yield* graph.markExpanded(sessionId, frontier.id)
                yield* hub.broadcast(sessionId, {
                  type: "exploration_complete",
                  explorationId: frontier.id,
                })
              })
            )
          ),
        { concurrency: 5 }
      )
    }
  })

export const startExploration = (
  sessionId: string,
  name: string
): Effect.Effect<
  void,
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const s2 = yield* OpenAlexService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    yield* graph.getOrCreateSession(sessionId)

    const researcher = yield* s2.searchAuthor(name)
    yield* graph.addResearcher(sessionId, researcher)

    const node: GraphNodeType = { type: "researcher", data: researcher }
    yield* hub.broadcast(sessionId, { type: "researcher_found", node })

    const discoveryFiber = yield* Effect.fork(discover(sessionId, researcher.id))
    trackFiber(sessionId, discoveryFiber)
    yield* Effect.fromFiber(discoveryFiber)

    const autoFiber = yield* Effect.fork(autoExpand(sessionId, 3))
    trackFiber(sessionId, autoFiber)
    yield* Effect.fromFiber(autoFiber)

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
  OpenAlexService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const hub = yield* WebSocketHubService
    const graph = yield* ResearchGraphService

    const fiber = yield* Effect.fork(expand(sessionId, frontierId))
    trackFiber(sessionId, fiber)
    yield* Effect.fromFiber(fiber)

    yield* graph.markExpanded(sessionId, frontierId)

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

export const elaborateFrontier = (
  sessionId: string,
  frontierId: string
): Effect.Effect<
  void,
  never,
  OpenAlexService | ResearchGraphService | WebSocketHubService | LlmService
> =>
  Effect.gen(function* () {
    const hub = yield* WebSocketHubService

    const fiber = yield* Effect.fork(collect(sessionId, frontierId))
    trackFiber(sessionId, fiber)
    yield* Effect.fromFiber(fiber)

    yield* hub.broadcast(sessionId, {
      type: "exploration_complete",
      explorationId: frontierId,
    })
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        console.error("[Orchestrator] elaborateFrontier error:", cause)
        const hub = yield* WebSocketHubService
        yield* hub.broadcast(sessionId, {
          type: "error",
          message: `Elaborate failed for frontier ${frontierId}`,
        })
      })
    )
  )
