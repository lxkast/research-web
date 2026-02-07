import { useEffect, useRef } from "react"
import { Graph, ExtensionCategory, register } from "@antv/g6"
import { ReactNode } from "@antv/g6-extension-react"
import type { GraphNodeType, ResearcherType, FrontierType } from "@research-web/shared"
import { useStore } from "../store/index.ts"
import { ResearcherNode } from "./nodes/ResearcherNode.tsx"
import { FrontierNode } from "./nodes/FrontierNode.tsx"

register(ExtensionCategory.NODE, "react", ReactNode)

function renderNode(nodeType: GraphNodeType["type"], nodeData: unknown) {
  switch (nodeType) {
    case "researcher":
      return <ResearcherNode data={nodeData as ResearcherType} />
    case "frontier":
      return <FrontierNode data={nodeData as FrontierType} />
    default:
      return <div className="node-card">{nodeType}</div>
  }
}

function toG6Nodes(nodes: GraphNodeType[]) {
  return nodes.map((n) => ({
    id: n.data.id,
    data: { nodeType: n.type, nodeData: n.data },
  }))
}

function toG6Edges(edges: { source: string; target: string }[], offset: number) {
  return edges.map((e, i) => ({
    id: `edge-${offset + i}`,
    source: e.source,
    target: e.target,
  }))
}

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false
    let graph: Graph | null = null
    let unsubscribe: (() => void) | null = null

    // Defer graph creation so StrictMode's immediate cleanup cancels the RAF
    // before a graph is ever instantiated (avoiding G6's "destroyed" warnings).
    const raf = requestAnimationFrame(() => {
      const { nodes, edges } = useStore.getState()

      graph = new Graph({
        container,
        autoResize: true,
        data: {
          nodes: toG6Nodes(nodes),
          edges: toG6Edges(edges, 0),
        },
        node: {
          type: "react",
          style: {
            size: [200, 100],
            component: (data: Record<string, unknown>) => {
              const d = data.data as { nodeType: GraphNodeType["type"]; nodeData: GraphNodeType["data"] }
              return renderNode(d.nodeType, d.nodeData)
            },
          },
        },
        edge: {
          style: {
            stroke: "#30363d",
            lineWidth: 1,
          },
        },
        layout: {
          type: "d3-force",
          manyBody: { strength: -200 },
          link: { distance: 200 },
          collide: { radius: 120 },
        },
        behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
      })

      graphRef.current = graph
      graph.render().catch(() => {
        // Graph may have been destroyed during async render
      })

      // Subscribe to future store additions
      let prevNodes = nodes.length
      let prevEdges = edges.length

      unsubscribe = useStore.subscribe((state) => {
        if (destroyed) return

        const newNodeCount = state.nodes.length
        const newEdgeCount = state.edges.length
        if (newNodeCount === prevNodes && newEdgeCount === prevEdges) return

        const addedNodes = toG6Nodes(state.nodes.slice(prevNodes))
        const addedEdges = toG6Edges(state.edges.slice(prevEdges), prevEdges)

        prevNodes = newNodeCount
        prevEdges = newEdgeCount

        if (addedNodes.length > 0 || addedEdges.length > 0) {
          graph!.addData({ nodes: addedNodes, edges: addedEdges })
          graph!.render().catch(() => {})
        }
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
