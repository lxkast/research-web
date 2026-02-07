import { describe, test, expect, mock } from "bun:test"
import { Effect } from "effect"
import { WebSocketHubService, WebSocketHubServiceLive } from "../WebSocketHubService.js"
import type { WsData } from "../WebSocketHubService.js"
import type { ServerWebSocket } from "bun"
import type { ServerMessage } from "@research-web/shared"

function makeMockWs(sessionId: string) {
  return {
    send: mock(() => {}),
    data: { sessionId },
  } as unknown as ServerWebSocket<WsData>
}

const testMsg: ServerMessage = {
  type: "exploration_complete",
  explorationId: "test-1",
}

function run(effect: Effect.Effect<void, never, WebSocketHubService>) {
  return Effect.runPromise(Effect.provide(effect, WebSocketHubServiceLive))
}

describe("WebSocketHubService", () => {
  test("register stores ws and unregister removes it", async () => {
    const ws = makeMockWs("s1")

    await run(
      Effect.gen(function* () {
        const hub = yield* WebSocketHubService
        yield* hub.register("s1", ws)
        yield* hub.broadcast("s1", testMsg)
        expect(ws.send).toHaveBeenCalledTimes(1)
        expect(ws.send).toHaveBeenCalledWith(JSON.stringify(testMsg))

        yield* hub.unregister(ws)
        yield* hub.broadcast("s1", testMsg)
        expect(ws.send).toHaveBeenCalledTimes(1) // no additional call
      })
    )
  })

  test("multiple sockets for same session both receive broadcasts", async () => {
    const ws1 = makeMockWs("s1")
    const ws2 = makeMockWs("s1")

    await run(
      Effect.gen(function* () {
        const hub = yield* WebSocketHubService
        yield* hub.register("s1", ws1)
        yield* hub.register("s1", ws2)
        yield* hub.broadcast("s1", testMsg)
        expect(ws1.send).toHaveBeenCalledTimes(1)
        expect(ws2.send).toHaveBeenCalledTimes(1)
      })
    )
  })

  test("unregister one socket leaves the other active", async () => {
    const ws1 = makeMockWs("s1")
    const ws2 = makeMockWs("s1")

    await run(
      Effect.gen(function* () {
        const hub = yield* WebSocketHubService
        yield* hub.register("s1", ws1)
        yield* hub.register("s1", ws2)
        yield* hub.unregister(ws1)
        yield* hub.broadcast("s1", testMsg)
        expect(ws1.send).toHaveBeenCalledTimes(0)
        expect(ws2.send).toHaveBeenCalledTimes(1)
      })
    )
  })

  test("broadcast targets only the given session", async () => {
    const ws1 = makeMockWs("s1")
    const ws2 = makeMockWs("s2")

    await run(
      Effect.gen(function* () {
        const hub = yield* WebSocketHubService
        yield* hub.register("s1", ws1)
        yield* hub.register("s2", ws2)
        yield* hub.broadcast("s1", testMsg)
        expect(ws1.send).toHaveBeenCalledTimes(1)
        expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(testMsg))
        expect(ws2.send).toHaveBeenCalledTimes(0)
      })
    )
  })

  test("broadcastAll sends to every connected socket", async () => {
    const ws1 = makeMockWs("s1")
    const ws2 = makeMockWs("s2")

    await run(
      Effect.gen(function* () {
        const hub = yield* WebSocketHubService
        yield* hub.register("s1", ws1)
        yield* hub.register("s2", ws2)
        yield* hub.broadcastAll(testMsg)
        expect(ws1.send).toHaveBeenCalledTimes(1)
        expect(ws2.send).toHaveBeenCalledTimes(1)
        const payload = JSON.stringify(testMsg)
        expect(ws1.send).toHaveBeenCalledWith(payload)
        expect(ws2.send).toHaveBeenCalledWith(payload)
      })
    )
  })
})
