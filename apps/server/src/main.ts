import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { FetchHttpClient } from "@effect/platform"
import { Effect, Layer, ManagedRuntime, Schema } from "effect"
import { ClientMessage } from "@research-web/shared"
import { Api } from "./api/routes.js"
import {
  SemanticScholarServiceLive,
  OpenAlexServiceStub,
  LlmServiceLive,
  ResearchGraphServiceLive,
  WebSocketHubService,
  WebSocketHubServiceLive,
} from "./services/index.js"
import type { WsData } from "./services/index.js"
import { startExploration, expandFrontier, elaborateFrontier } from "./agents/Orchestrator.js"

// --- Effect layers ---

const ApiGroupLive = HttpApiBuilder.group(Api, "api", (handlers) =>
  handlers
    .handle("health", () =>
      Effect.succeed({ status: "ok" })
    )
    .handle("explore", ({ payload }) =>
      Effect.sync(() => {
        appRuntime.runFork(startExploration(payload.sessionId, payload.name))
        return { sessionId: payload.sessionId }
      })
    )
)

const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(ApiGroupLive))

const ServiceLayer = Layer.mergeAll(
  SemanticScholarServiceLive.pipe(Layer.provide(FetchHttpClient.layer)),
  OpenAlexServiceStub,
  LlmServiceLive,
  ResearchGraphServiceLive,
  WebSocketHubServiceLive,
)

// --- Shared runtime (singletons across HTTP + WS) ---

const appRuntime = ManagedRuntime.make(ServiceLayer)

const { handler: httpHandler } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(ApiLive, HttpServer.layerContext),
  { memoMap: appRuntime.memoMap },
)

// --- Schema decoder ---

const decodeClientMessage = Schema.decodeUnknownSync(ClientMessage)

// --- Bun.serve with HTTP + WebSocket ---

Bun.serve<WsData>({
  port: 3001,

  fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("sessionId") ?? crypto.randomUUID()
      const upgraded = server.upgrade(req, { data: { sessionId } })
      if (upgraded) return undefined
      return new Response("WebSocket upgrade failed", { status: 400 })
    }

    return httpHandler(req)
  },

  websocket: {
    open(ws) {
      appRuntime.runPromise(
        Effect.gen(function* () {
          const hub = yield* WebSocketHubService
          yield* hub.register(ws.data.sessionId, ws)
          console.log(`[ws] connected: ${ws.data.sessionId}`)
        }),
      )
    },

    message(ws, raw) {
      try {
        const parsed = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw))
        const msg = decodeClientMessage(parsed)
        switch (msg.type) {
          case "stop":
            console.log(`[ws] stop requested by ${ws.data.sessionId}`)
            break
          case "expand":
            console.log(`[ws] expand requested for frontier ${msg.frontierId}`)
            appRuntime.runFork(expandFrontier(ws.data.sessionId, msg.frontierId))
            break
          case "elaborate":
            console.log(`[ws] elaborate requested for frontier ${msg.frontierId}`)
            appRuntime.runFork(elaborateFrontier(ws.data.sessionId, msg.frontierId))
            break
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: `invalid message: ${String(err)}` }))
      }
    },

    close(ws) {
      appRuntime.runPromise(
        Effect.gen(function* () {
          const hub = yield* WebSocketHubService
          yield* hub.unregister(ws)
          console.log(`[ws] disconnected: ${ws.data.sessionId}`)
        }),
      )
    },
  },
})

console.log("Server listening on http://localhost:3001")
