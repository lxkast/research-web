import { useEffect, useRef } from "react"
import { SearchBar } from "./components/SearchBar.tsx"
import { GraphCanvas } from "./components/GraphCanvas.tsx"
import { WsStatus } from "./components/WsStatus.tsx"
import { useWebSocket } from "./hooks/useWebSocket.ts"
import { useStore } from "./store/index.ts"
import { mockNodes, mockEdges } from "./store/mockData.ts"

export function App() {
  const loadedRef = useRef(false)

  useWebSocket("ws://localhost:5173/ws")

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const { addNodes, addEdges } = useStore.getState()
    addNodes(mockNodes)
    addEdges(mockEdges)
  }, [])

  return (
    <>
      <SearchBar />
      <WsStatus />
      <GraphCanvas />
    </>
  )
}
