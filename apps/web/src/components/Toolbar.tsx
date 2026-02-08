import { useStore } from "../store/index.ts"

export function Toolbar() {
  const hasActive = useStore((s) => s.activeExplorations.size > 0)
  const sendWsMessage = useStore((s) => s.sendWsMessage)
  const reset = useStore((s) => s.reset)

  return (
    <div className="toolbar">
      {hasActive && (
        <button onClick={() => sendWsMessage?.({ type: "stop" })}>
          Stop
        </button>
      )}
      <button onClick={reset}>Reset</button>
    </div>
  )
}
