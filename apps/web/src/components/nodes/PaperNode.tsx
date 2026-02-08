import { Option } from "effect"
import type { PaperType } from "@research-web/shared"

export function PaperNode({ data }: { data: PaperType }) {
  return (
    <div className="node-card node-paper">
      <div className="node-title">{data.title}</div>
      <div className="node-stats">
        <span>{data.year} &middot; {data.citationCount.toLocaleString()} citations</span>
      </div>
      {Option.isSome(data.tldr) && (
        <div className="node-tldr">{data.tldr.value}</div>
      )}
    </div>
  )
}
