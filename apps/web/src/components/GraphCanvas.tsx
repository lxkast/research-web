import { useEffect, useRef } from "react"
import { Graph, ExtensionCategory, register } from "@antv/g6"
import { ReactNode } from "@antv/g6-extension-react"
import type { GraphNodeType, ResearcherType, FrontierType, PaperType } from "@research-web/shared"
import { useStore } from "../store/index.ts"
import { ResearcherNode } from "./nodes/ResearcherNode.tsx"
import { FrontierNode } from "./nodes/FrontierNode.tsx"
import { PaperNode } from "./nodes/PaperNode.tsx"
import { ContributorNode } from "./nodes/ContributorNode.tsx"

register(ExtensionCategory.NODE, "react", ReactNode)

export const graphRef: { current: Graph | null } = { current: null }

function renderNode(nodeType: GraphNodeType["type"], nodeData: unknown) {
  switch (nodeType) {
    case "researcher":
      return <ResearcherNode data={nodeData as ResearcherType} />
    case "frontier":
      return <FrontierNode data={nodeData as FrontierType} />
    case "paper":
      return <PaperNode data={nodeData as PaperType} />
    case "contributor":
      return <ContributorNode data={nodeData as { id: string; name: string }} />
    default:
      return <div className="node-card">{nodeType}</div>
  }
}

function elaboratedFrontierHeight(paperCount: number): number {
  return 120 + Math.min(paperCount * 45, 340)
}

function nodeSize(nodeType: string, nodeId?: string): [number, number] {
  switch (nodeType) {
    case "paper":
      return [180, 90]
    case "contributor":
      return [140, 40]
    case "frontier":
      const papers = nodeId ? useStore.getState().frontierPapers.get(nodeId) : undefined
      if (papers && papers.length > 0) {
        return [420, elaboratedFrontierHeight(papers.length)]
      }
      return [200, 100]
    default:
      return [200, 100]
  }
}

function toG6Nodes(
  nodes: GraphNodeType[],
  nodeToCombo: Map<string, string>,
  positions?: Map<string, [number, number]>
) {
  return nodes.map((n) => {
    const comboId = nodeToCombo.get(n.data.id)
    const pos = positions?.get(n.data.id)
    return {
      id: n.data.id,
      data: { nodeType: n.type, nodeData: n.data },
      ...(comboId ? { combo: "combo-" + comboId } : {}),
      ...(pos ? { style: { x: pos[0], y: pos[1] } } : {}),
    }
  })
}

function toG6Edges(edges: { source: string; target: string; type?: string }[], offset: number) {
  return edges
    .filter((e) => e.type !== "has_paper" && e.type !== "has_contributor")
    .map((e, i) => ({
      id: `edge-${offset + i}`,
      source: e.source,
      target: e.target,
    }))
}

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false
    let graph: Graph | null = null
    let unsubscribe: (() => void) | null = null

    // Defer graph creation so StrictMode's immediate cleanup cancels the RAF
    // before a graph is ever instantiated (avoiding G6's "destroyed" warnings).
    const raf = requestAnimationFrame(() => {
      const state = useStore.getState()
      const { nodes, edges, combos, nodeToCombo } = state

      graph = new Graph({
        container,
        autoResize: true,
        data: {
          nodes: toG6Nodes(nodes, nodeToCombo),
          edges: toG6Edges(edges, 0),
          combos: combos.map((c) => ({
            id: "combo-" + c.comboId,
            data: { label: c.label },
          })),
        },
        node: {
          type: "react",
          style: {
            size: (data: Record<string, unknown>) => {
              const d = data.data as { nodeType: string; nodeData: { id: string } }
              return nodeSize(d.nodeType, d.nodeData.id)
            },
            component: (data: Record<string, unknown>) => {
              const d = data.data as { nodeType: GraphNodeType["type"]; nodeData: GraphNodeType["data"] }
              return renderNode(d.nodeType, d.nodeData)
            },
          },
        },
        edge: {
          style: {
            stroke: "#8b949e",
            lineWidth: 2,
          },
        },
        combo: {
          type: "rect",
          style: {
            radius: 8,
            padding: [36, 16, 16, 16],
            lineWidth: 1,
            stroke: "#30363d",
            fill: "#161b22",
            fillOpacity: 0.5,
            labelText: (d: Record<string, unknown>) => {
              const data = d.data as { label?: string } | undefined
              return data?.label ?? ""
            },
            labelPlacement: "top",
            labelFill: "#8b949e",
            labelFontSize: 11,
          },
        },
        layout: {
          type: "d3-force",
          manyBody: { strength: -100 },
          link: { distance: 400 },
          collide: {
            radius: (node: Record<string, unknown>) => {
              const [w, h] = nodeSize(node.nodeType as string, (node.nodeData as { id: string })?.id)
              return Math.max(w, h) / 2 + 20
            },
            iterations: 3,
          },
          center: { x: container.clientWidth / 2, y: container.clientHeight / 2, strength: 0.05 },
        },
        behaviors: ["drag-canvas", "zoom-canvas", "drag-element", "collapse-expand"],
      })

      graphRef.current = graph
      graph.render().catch(() => {
        // Graph may have been destroyed during async render
      })

      // Subscribe to future store additions
      let prevNodes = nodes.length
      let prevEdges = edges.length
      let prevCombos = combos.length
      let prevFrontierPapersSize = state.frontierPapers.size
      let pendingRaf: number | null = null

      unsubscribe = useStore.subscribe((state) => {
        if (destroyed) return

        const newNodeCount = state.nodes.length
        const newEdgeCount = state.edges.length
        const newComboCount = state.combos.length
        const newFrontierPapersSize = state.frontierPapers.size

        const graphChanged =
          newNodeCount !== prevNodes ||
          newEdgeCount !== prevEdges ||
          newComboCount !== prevCombos
        const papersChanged = newFrontierPapersSize !== prevFrontierPapersSize

        if (!graphChanged && !papersChanged) return

        // Cancel any pending frame — we'll process the latest state instead
        if (pendingRaf !== null) {
          cancelAnimationFrame(pendingRaf)
        }

        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = null
          if (destroyed) return

          // Re-read state — it may have advanced further since the subscribe fired
          const latest = useStore.getState()
          const latestNodeCount = latest.nodes.length
          const latestEdgeCount = latest.edges.length
          const latestComboCount = latest.combos.length
          const latestFrontierPapersSize = latest.frontierPapers.size

          const batchGraphChanged =
            latestNodeCount !== prevNodes ||
            latestEdgeCount !== prevEdges ||
            latestComboCount !== prevCombos
          const batchPapersChanged = latestFrontierPapersSize !== prevFrontierPapersSize

          if (!batchGraphChanged && !batchPapersChanged) return

          const positionMap = new Map<string, [number, number]>()
          const newNodes = batchGraphChanged ? latest.nodes.slice(prevNodes) : []
          const newNodeIds = new Set(newNodes.map((n) => n.data.id))

          if (batchGraphChanged) {
            const CHILD_RADIUS = 400

            const addedCombos = latest.combos.slice(prevCombos).map((c) => ({
              id: "combo-" + c.comboId,
              data: { label: c.label },
            }))

            const addedEdges = toG6Edges(latest.edges.slice(prevEdges), prevEdges)

            // Identify expanded nodes: sources of new edges that already exist in the graph
            const newStoreEdges = latest.edges.slice(prevEdges)
            const expandedNodeIds = new Set<string>()
            for (const e of newStoreEdges) {
              if (!newNodeIds.has(e.source)) {
                expandedNodeIds.add(e.source)
              }
            }

            for (const expandedId of expandedNodeIds) {
              const pos = graph!.getElementPosition(expandedId)
              const ex = pos[0]
              const ey = pos[1]

              // Find children of this expanded node among new nodes
              const children = newStoreEdges
                .filter((e) => e.source === expandedId && newNodeIds.has(e.target))
                .map((e) => e.target)

              // Place children in circle around expanded node
              for (let i = 0; i < children.length; i++) {
                const angle = (2 * Math.PI * i) / children.length - Math.PI / 2
                const cx = ex + CHILD_RADIUS * Math.cos(angle)
                const cy = ey + CHILD_RADIUS * Math.sin(angle)
                positionMap.set(children[i], [cx, cy])
              }
            }

            prevNodes = latestNodeCount
            prevEdges = latestEdgeCount
            prevCombos = latestComboCount

            if (addedCombos.length > 0) {
              graph!.addComboData(addedCombos)
            }

            const addedNodes = toG6Nodes(newNodes, latest.nodeToCombo, positionMap)
            if (addedNodes.length > 0 || addedEdges.length > 0) {
              graph!.addData({ nodes: addedNodes, edges: addedEdges })
            }
          }

          if (batchPapersChanged) {
            for (const [frontierId, papers] of latest.frontierPapers) {
              graph!.updateNodeData([{
                id: frontierId,
                style: { size: [420, elaboratedFrontierHeight(papers.length)] },
              }])
            }
            prevFrontierPapersSize = latestFrontierPapersSize
          }

          if (batchGraphChanged) {
            graph!.stopLayout()
            graph!.render().catch(() => {})
          } else {
            graph!.stopLayout()
            graph!.render().catch(() => {})
          }
        })
      })
    })

    return () => {
      cancelAnimationFrame(raf)
      destroyed = true
      graphRef.current = null
      unsubscribe?.()
      graph?.destroy()
    }
  }, [])

  return <div ref={containerRef} className="graph-container" />
}
