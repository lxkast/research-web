import { useStore } from "../store/index.ts"

const labels = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
} as const

const dotColors = {
  connected: "var(--green)",
  connecting: "#d29922",
  disconnected: "#f85149",
} as const

export function WsStatus() {
  const wsStatus = useStore((s) => s.wsStatus)

  return (
    <div className="ws-status">
      <span className="ws-status-dot" style={{ background: dotColors[wsStatus] }} />
      {labels[wsStatus]}
    </div>
  )
}
