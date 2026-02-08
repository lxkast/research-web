import { Option } from "effect"
import type { PaperType } from "@research-web/shared"
import { useStore } from "../../store/index.ts"
import { getDepthColor } from "../../lib/depthColors.ts"

export function PaperNode({ data }: { data: PaperType }) {
  const depth = useStore((s) => s.nodeDepths.get(data.id) ?? 0)

  return (
    <div className="node-card node-paper" style={{ '--node-color': getDepthColor(depth) } as React.CSSProperties}>
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
