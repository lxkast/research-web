import { useEffect, useRef } from "react"
import { SearchBar } from "./components/SearchBar.tsx"
import { GraphCanvas } from "./components/GraphCanvas.tsx"
import { useStore } from "./store/index.ts"
import { mockNodes, mockEdges } from "./store/mockData.ts"

export function App() {
  const loadedRef = useRef(false)

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
      <GraphCanvas />
    </>
  )
}
