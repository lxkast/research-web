import { useEffect, useCallback, useRef } from "react"
import { useStore } from "../store/index.ts"
import type { ClientMessageType, ServerMessageType } from "@research-web/shared"

export function dispatchServerMessage(msg: ServerMessageType) {
  const { addNodes, addEdges, setExplorationComplete } = useStore.getState()

  switch (msg.type) {
    case "researcher_found":
      addNodes([msg.node])
      break
    case "frontiers_discovered":
      addNodes([...msg.nodes])
      addEdges([...msg.edges])
      break
    case "papers_collected":
      addNodes([...msg.nodes])
      addEdges([...msg.edges])
      break
    case "exploration_complete":
      setExplorationComplete(msg.explorationId)
      break
    case "exploration_cancelled":
    case "error":
      break
  }
}

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const setWsStatus = useStore((s) => s.setWsStatus)

  useEffect(() => {
    let cancelled = false
    const ws = new WebSocket(url)
    wsRef.current = ws

    setWsStatus("connecting")

    ws.onopen = () => {
      if (cancelled) return ws.close()
      setWsStatus("connected")
    }

    ws.onmessage = (event) => {
      if (cancelled) return
      try {
        const msg = JSON.parse(event.data) as ServerMessageType
        dispatchServerMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (cancelled) return
      setWsStatus("disconnected")
    }

    ws.onerror = () => {
      if (cancelled) return
      setWsStatus("disconnected")
    }

    return () => {
      cancelled = true
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      wsRef.current = null
    }
  }, [url, setWsStatus])

  const send = useCallback((msg: ClientMessageType) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  return { send }
}
