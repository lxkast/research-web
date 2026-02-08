import type { ResearcherType } from "@research-web/shared"
import { useStore } from "../../store/index.ts"

export function ResearcherNode({ data }: { data: ResearcherType }) {
  const isLoading = useStore((s) => s.activeExplorations.has(s.sessionId))

  return (
    <div className={`node-card node-researcher${isLoading ? " loading" : ""}`}>
      <div className="node-title">{data.name}</div>
      <div className="node-stats">
        <span>{data.paperCount} papers</span>
        <span>{data.citationCount.toLocaleString()} citations</span>
        <span>h-index {data.hIndex}</span>
      </div>
      {isLoading && (
        <div className="node-loading-status">Discovering frontiers...</div>
      )}
    </div>
  )
}
