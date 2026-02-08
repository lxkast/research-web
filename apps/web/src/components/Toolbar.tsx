import { Effect } from "effect"
import { useStore } from "../store/index.ts"
import { stopExploration, resetStore } from "../lib/actions.ts"
import { arrangeGraph } from "../lib/layout.ts"

export function Toolbar() {
  const hasActive = useStore((s) => s.activeExplorations.size > 0)
  const hasNodes = useStore((s) => s.nodes.length > 0)

  return (
    <div className="toolbar">
      {hasActive && (
        <button onClick={() => Effect.runSync(stopExploration)}>
          Stop
        </button>
      )}
      {hasNodes && <button onClick={arrangeGraph}>Arrange</button>}
      <button onClick={() => Effect.runSync(resetStore)}>Reset</button>
    </div>
  )
}
