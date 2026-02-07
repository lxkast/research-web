import type { FrontierType } from "@research-web/shared"

export function FrontierNode({ data }: { data: FrontierType }) {
  return (
    <div className="node-card node-frontier">
      <div className="node-title">{data.label}</div>
      <div className="node-summary">{data.summary}</div>
      <div className="node-actions">
        <button onClick={() => console.log("expand", data.id)}>Expand</button>
        <button onClick={() => console.log("elaborate", data.id)}>
          Elaborate
        </button>
      </div>
    </div>
  )
}
