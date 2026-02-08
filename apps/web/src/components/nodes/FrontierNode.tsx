import type { FrontierType } from "@research-web/shared"
import { useStore } from "../../store/index.ts"

export function FrontierNode({ data }: { data: FrontierType }) {
  return (
    <div className="node-card node-frontier">
      <div className="node-title">{data.label}</div>
      <div className="node-summary">{data.summary}</div>
      <div className="node-actions">
        <button
          onClick={() =>
            useStore
              .getState()
              .sendWsMessage?.({ type: "expand", frontierId: data.id })
          }
        >
          Expand
        </button>
        <button
          onClick={() =>
            useStore
              .getState()
              .sendWsMessage?.({ type: "elaborate", frontierId: data.id })
          }
        >
          Elaborate
        </button>
      </div>
    </div>
  )
}
