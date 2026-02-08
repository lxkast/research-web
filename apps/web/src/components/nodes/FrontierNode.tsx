import { Effect } from "effect"
import type { FrontierType } from "@research-web/shared"
import { useStore } from "../../store/index.ts"
import { expandFrontier, elaborateFrontier } from "../../lib/actions.ts"

export function FrontierNode({ data }: { data: FrontierType }) {
  const papers = useStore((s) => s.frontierPapers.get(data.id))
  const isLoading = useStore((s) => s.activeExplorations.has(data.id))
  const hasPapers = papers && papers.length > 0

  return (
    <div className={`node-card node-frontier${hasPapers ? " node-frontier-elaborated" : ""}${isLoading ? " loading" : ""}`}>
      <div className="node-title">{data.label}</div>
      <div className="node-summary">{data.summary}</div>
      {hasPapers && (
        <div className="frontier-papers">
          {papers.map((p) => (
            <div key={p.id} className="frontier-paper-item">
              <div className="frontier-paper-title">{p.title}</div>
              <div className="frontier-paper-stats">
                {p.year} &middot; {p.citationCount} citations
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="node-actions">
        <button
          disabled={isLoading}
          onClick={() => Effect.runSync(expandFrontier(data.id))}
        >
          {isLoading ? "Loading\u2026" : "Expand"}
        </button>
        {!hasPapers && (
          <button
            disabled={isLoading}
            onClick={() => Effect.runSync(elaborateFrontier(data.id))}
          >
            {isLoading ? "Loading\u2026" : "Elaborate"}
          </button>
        )}
      </div>
    </div>
  )
}
