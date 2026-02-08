import { SearchBar } from "./components/SearchBar.tsx"
import { GraphCanvas } from "./components/GraphCanvas.tsx"
import { WsStatus } from "./components/WsStatus.tsx"
import { useWebSocket } from "./hooks/useWebSocket.ts"
import { useStore } from "./store/index.ts"

export function App() {
  const sessionId = useStore((s) => s.sessionId)

  useWebSocket(`ws://localhost:5173/ws?sessionId=${sessionId}`)

  return (
    <>
      <SearchBar />
      <WsStatus />
      <GraphCanvas />
    </>
  )
}
