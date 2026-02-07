import type { ResearcherType } from "@research-web/shared"

export function ResearcherNode({ data }: { data: ResearcherType }) {
  return (
    <div className="node-card node-researcher">
      <div className="node-title">{data.name}</div>
      <div className="node-stats">
        <span>{data.paperCount} papers</span>
        <span>{data.citationCount.toLocaleString()} citations</span>
        <span>h-index {data.hIndex}</span>
      </div>
    </div>
  )
}
