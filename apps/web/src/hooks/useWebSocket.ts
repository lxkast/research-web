import { useEffect, useCallback, useRef } from "react"
import { Schema } from "effect"
import { useStore } from "../store/index.ts"
import { ServerMessage } from "@research-web/shared"
import type { ClientMessageType, ServerMessageType } from "@research-web/shared"

const decodeServerMessage = Schema.decodeUnknownSync(ServerMessage)

export function dispatchServerMessage(msg: ServerMessageType) {
  const state = useStore.getState()
  const { addNodes, addEdges, setExplorationComplete, setFrontierPapers, clearAllExplorations, addError } = state

  switch (msg.type) {
    case "researcher_found":
      addNodes([msg.node])
      state.setExplorationActive(state.sessionId)
      break
    case "frontiers_discovered":
      addNodes([...msg.nodes])
      addEdges([...msg.edges])
      break
    case "papers_collected": {
      const papers = msg.nodes
        .filter((n) => n.type === "paper")
        .map((n) => n.data as import("@research-web/shared").PaperType)
      setFrontierPapers(msg.frontierId, papers)
      break
    }
    case "exploration_complete":
      setExplorationComplete(msg.explorationId)
      break
    case "exploration_cancelled":
      clearAllExplorations()
      break
    case "error":
      addError(msg.message)
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
      useStore.getState().setSendWsMessage((msg) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        }
      })
    }

    ws.onmessage = (event) => {
      if (cancelled) return
      try {
        const raw = JSON.parse(event.data)
        const msg = decodeServerMessage(raw)
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
      useStore.getState().setSendWsMessage(null)
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
