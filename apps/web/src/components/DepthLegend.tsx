import { useStore } from "../store/index.ts"
import { getDepthColor } from "../lib/depthColors.ts"

export function DepthLegend() {
  const nodeDepths = useStore((s) => s.nodeDepths)

  if (nodeDepths.size === 0) return null

  const depths = [...new Set(nodeDepths.values())].sort((a, b) => a - b)

  return (
    <div className="depth-legend">
      {depths.map((d) => (
        <div key={d} className="depth-legend-row">
          <div
            className="depth-legend-swatch"
            style={{ background: getDepthColor(d) }}
          />
          <span>Depth {d}</span>
        </div>
      ))}
    </div>
  )
}
