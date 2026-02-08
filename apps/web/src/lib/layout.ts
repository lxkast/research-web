import { graphRef } from "../components/GraphCanvas.tsx"
import { useStore } from "../store/index.ts"

export function arrangeGraph() {
  const graph = graphRef.current
  if (!graph) return

  const { nodes, edges } = useStore.getState()
  if (nodes.length === 0) return

  // Find root (researcher) node
  const researcher = nodes.find((n) => n.type === "researcher")
  if (!researcher) return
  const rootId = researcher.data.id

  // Build adjacency: parent → children (directed, source→target)
  const children = new Map<string, string[]>()
  for (const e of edges) {
    if (!children.has(e.source)) children.set(e.source, [])
    children.get(e.source)!.push(e.target)
  }

  // BFS to compute positions in concentric circles
  const positions = new Map<string, [number, number]>()
  const rootPos = graph.getElementPosition(rootId)
  const cx = rootPos[0]
  const cy = rootPos[1]
  positions.set(rootId, [cx, cy])

  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }]
  const visited = new Set<string>([rootId])

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    const kids = children.get(id)
    if (!kids || kids.length === 0) continue

    const parentPos = positions.get(id)!
    const radius = depth === 0 ? 800 : depth === 1 ? 300 : Math.max(150 / depth, 50)

    for (let i = 0; i < kids.length; i++) {
      const childId = kids[i]
      if (visited.has(childId)) continue
      visited.add(childId)

      const angle = (2 * Math.PI * i) / kids.length - Math.PI / 2
      const x = parentPos[0] + radius * Math.cos(angle)
      const y = parentPos[1] + radius * Math.sin(angle)
      positions.set(childId, [x, y])
      queue.push({ id: childId, depth: depth + 1 })
    }
  }

  graph.stopLayout()

  // Move each node to its computed position
  const moves = Array.from(positions.entries()).map(([id, [x, y]]) =>
    graph.translateElementTo(id, [x, y], true)
  )
  Promise.all(moves).then(() => graph.draw())
}
