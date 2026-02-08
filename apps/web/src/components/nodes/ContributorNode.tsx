import { useStore } from "../../store/index.ts"
import { getDepthColor } from "../../lib/depthColors.ts"

export function ContributorNode({ data }: { data: { id: string; name: string } }) {
  const depth = useStore((s) => s.nodeDepths.get(data.id) ?? 0)

  return (
    <div className="node-card node-contributor" style={{ '--node-color': getDepthColor(depth) } as React.CSSProperties}>
      <div className="node-title">{data.name}</div>
    </div>
  )
}
