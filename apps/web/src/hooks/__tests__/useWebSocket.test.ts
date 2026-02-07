import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useWebSocket } from "../useWebSocket.ts"
import { useStore } from "../../store/index.ts"
import { MockWebSocket } from "../../test/MockWebSocket.ts"

let originalWebSocket: typeof globalThis.WebSocket

beforeEach(() => {
  originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  MockWebSocket.reset()
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

describe("useWebSocket", () => {
  test("status goes connecting → connected on open", () => {
    expect(useStore.getState().wsStatus).toBe("disconnected")

    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    expect(useStore.getState().wsStatus).toBe("connecting")

    act(() => {
      MockWebSocket.instances[0].simulateOpen()
    })
    expect(useStore.getState().wsStatus).toBe("connected")
  })

  test("status goes disconnected on close", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    act(() => MockWebSocket.instances[0].simulateOpen())
    expect(useStore.getState().wsStatus).toBe("connected")

    act(() => MockWebSocket.instances[0].simulateClose())
    expect(useStore.getState().wsStatus).toBe("disconnected")
  })

  test("status goes disconnected on error", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    act(() => MockWebSocket.instances[0].simulateOpen())
    expect(useStore.getState().wsStatus).toBe("connected")

    act(() => MockWebSocket.instances[0].simulateError())
    expect(useStore.getState().wsStatus).toBe("disconnected")
  })

  test("server messages dispatch to store", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    act(() => MockWebSocket.instances[0].simulateOpen())

    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "researcher_found",
        node: { type: "researcher", data: { id: "r1", name: "Alice", affiliations: [], paperCount: 0, citationCount: 0, hIndex: 0 } },
      })
    })

    expect(useStore.getState().nodes).toHaveLength(1)
    expect(useStore.getState().nodes[0].data.id).toBe("r1")
  })

  test("send calls ws.send with JSON; cleanup calls ws.close", () => {
    const { result, unmount } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    const mockWs = MockWebSocket.instances[0]
    act(() => mockWs.simulateOpen())

    act(() => {
      result.current.send({ type: "stop" })
    })
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "stop" }))

    unmount()
    expect(mockWs.close).toHaveBeenCalled()
  })

  test("send is a no-op when socket is not OPEN", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    const mockWs = MockWebSocket.instances[0]
    // socket is still CONNECTING — do not open it

    act(() => {
      result.current.send({ type: "stop" })
    })
    expect(mockWs.send).not.toHaveBeenCalled()
  })

  test("malformed JSON messages are swallowed without error", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    const mockWs = MockWebSocket.instances[0]
    act(() => mockWs.simulateOpen())

    const nodesBefore = useStore.getState().nodes

    expect(() => {
      act(() => {
        mockWs.simulateRawMessage("not valid json{{{")
      })
    }).not.toThrow()

    expect(useStore.getState().nodes).toEqual(nodesBefore)
  })

  test("cancelled flag prevents stale callbacks after unmount", () => {
    const { unmount } = renderHook(() => useWebSocket("ws://localhost:3001/ws"))
    const mockWs = MockWebSocket.instances[0]

    unmount()

    act(() => {
      mockWs.readyState = MockWebSocket.OPEN
      mockWs.onopen?.(new Event("open"))
    })

    // Status must NOT be "connected" — the cancelled flag should prevent stale onopen
    expect(useStore.getState().wsStatus).not.toBe("connected")
  })
})
