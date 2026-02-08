import { Context, Effect, Layer, Schema } from "effect"
import type { ServerWebSocket } from "bun"
import { ServerMessage } from "@research-web/shared"

export interface WsData {
  sessionId: string
}

const encodeServerMessage = Schema.encodeSync(ServerMessage)

export interface WebSocketHubServiceI {
  readonly register: (sessionId: string, ws: ServerWebSocket<WsData>) => Effect.Effect<void>
  readonly unregister: (ws: ServerWebSocket<WsData>) => Effect.Effect<void>
  readonly broadcast: (clientId: string, message: typeof ServerMessage.Type) => Effect.Effect<void>
  readonly broadcastAll: (message: typeof ServerMessage.Type) => Effect.Effect<void>
}

export class WebSocketHubService extends Context.Tag("WebSocketHubService")<
  WebSocketHubService,
  WebSocketHubServiceI
>() {}

export const WebSocketHubServiceLive = Layer.sync(WebSocketHubService, () => {
  const sessionToWs = new Map<string, Set<ServerWebSocket<WsData>>>()
  const wsToSession = new Map<ServerWebSocket<WsData>, string>()

  return {
    register: (sessionId, ws) =>
      Effect.sync(() => {
        let sockets = sessionToWs.get(sessionId)
        if (!sockets) {
          sockets = new Set()
          sessionToWs.set(sessionId, sockets)
        }
        sockets.add(ws)
        wsToSession.set(ws, sessionId)
      }),

    unregister: (ws) =>
      Effect.sync(() => {
        const sessionId = wsToSession.get(ws)
        if (sessionId) {
          const sockets = sessionToWs.get(sessionId)
          if (sockets) {
            sockets.delete(ws)
            if (sockets.size === 0) sessionToWs.delete(sessionId)
          }
          wsToSession.delete(ws)
        }
      }),

    broadcast: (clientId, message) =>
      Effect.sync(() => {
        const sockets = sessionToWs.get(clientId)
        if (sockets) {
          const payload = JSON.stringify(encodeServerMessage(message))
          for (const ws of sockets) ws.send(payload)
        }
      }),

    broadcastAll: (message) =>
      Effect.sync(() => {
        const payload = JSON.stringify(encodeServerMessage(message))
        for (const ws of wsToSession.keys()) ws.send(payload)
      }),
  }
})

export const WebSocketHubServiceStub = Layer.succeed(WebSocketHubService, {
  register: () => Effect.die("not implemented"),
  unregister: () => Effect.die("not implemented"),
  broadcast: () => Effect.die("not implemented"),
  broadcastAll: () => Effect.die("not implemented"),
})
