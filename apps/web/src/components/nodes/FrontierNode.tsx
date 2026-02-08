import type { FrontierType } from "@research-web/shared"
import { useStore } from "../../store/index.ts"

export function FrontierNode({ data }: { data: FrontierType }) {
  const papers = useStore((s) => s.frontierPapers.get(data.id))
  const hasPapers = papers && papers.length > 0

  return (
    <div className={`node-card node-frontier${hasPapers ? " node-frontier-elaborated" : ""}`}>
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
          onClick={() =>
            useStore
              .getState()
              .sendWsMessage?.({ type: "expand", frontierId: data.id })
          }
        >
          Expand
        </button>
        {!hasPapers && (
          <button
            onClick={() =>
              useStore
                .getState()
                .sendWsMessage?.({ type: "elaborate", frontierId: data.id })
            }
          >
            Elaborate
          </button>
        )}
      </div>
    </div>
  )
}
