import { Effect } from "effect"
import { useStore } from "../store/index.ts"
import { stopExploration, resetStore } from "../lib/actions.ts"

export function Toolbar() {
  const hasActive = useStore((s) => s.activeExplorations.size > 0)

  return (
    <div className="toolbar">
      {hasActive && (
        <button onClick={() => Effect.runSync(stopExploration)}>
          Stop
        </button>
      )}
      <button onClick={() => Effect.runSync(resetStore)}>Reset</button>
    </div>
  )
}
