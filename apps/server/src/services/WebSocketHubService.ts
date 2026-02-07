import { Context, Effect, Layer } from "effect"
import type { ServerMessage } from "@research-web/shared"

export interface WebSocketHubServiceI {
  readonly broadcast: (clientId: string, message: ServerMessage) => Effect.Effect<void>
  readonly broadcastAll: (message: ServerMessage) => Effect.Effect<void>
}

export class WebSocketHubService extends Context.Tag("WebSocketHubService")<
  WebSocketHubService,
  WebSocketHubServiceI
>() {}

export const WebSocketHubServiceStub = Layer.succeed(WebSocketHubService, {
  broadcast: () => Effect.die("not implemented"),
  broadcastAll: () => Effect.die("not implemented"),
})
