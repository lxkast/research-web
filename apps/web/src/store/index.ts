import { create } from "zustand"
import type { GraphNodeType, GraphEdgeType, ClientMessageType, PaperType } from "@research-web/shared"

interface AppState {
  sessionId: string
  nodes: GraphNodeType[]
  edges: GraphEdgeType[]
  wsStatus: "disconnected" | "connecting" | "connected"
  activeExplorations: Set<string>
  selectedNode: string | null
  sendWsMessage: ((msg: ClientMessageType) => void) | null
  combos: Array<{ comboId: string; label: string }>
  nodeToCombo: Map<string, string>
  frontierPapers: Map<string, PaperType[]>
  errors: Array<{ id: string; message: string }>
  nodeDepths: Map<string, number>

  addNodes: (nodes: GraphNodeType[]) => void
  addEdges: (edges: GraphEdgeType[]) => void
  addNodesAndEdges: (nodes: GraphNodeType[], edges: GraphEdgeType[]) => void
  setWsStatus: (status: AppState["wsStatus"]) => void
  setSelectedNode: (id: string | null) => void
  setExplorationActive: (id: string) => void
  setExplorationComplete: (id: string) => void
  clearAllExplorations: () => void
  setSendWsMessage: (fn: ((msg: ClientMessageType) => void) | null) => void
  addCombo: (comboId: string, label: string) => void
  setNodeComboBatch: (entries: [string, string][]) => void
  setFrontierPapers: (frontierId: string, papers: PaperType[]) => void
  addError: (message: string) => void
  dismissError: (id: string) => void
  reset: () => void
}

const initialState = {
  sessionId: crypto.randomUUID(),
  nodes: [] as GraphNodeType[],
  edges: [] as GraphEdgeType[],
  wsStatus: "disconnected" as const,
  activeExplorations: new Set<string>(),
  selectedNode: null as string | null,
  sendWsMessage: null as ((msg: ClientMessageType) => void) | null,
  combos: [] as Array<{ comboId: string; label: string }>,
  nodeToCombo: new Map<string, string>(),
  frontierPapers: new Map<string, PaperType[]>(),
  errors: [] as Array<{ id: string; message: string }>,
  nodeDepths: new Map<string, number>(),
}

function computeDepths(nodes: GraphNodeType[], edges: GraphEdgeType[]): Map<string, number> {
  const depths = new Map<string, number>()
  const researcher = nodes.find((n) => n.type === "researcher")
  if (!researcher) return depths

  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }

  const rootId = researcher.data.id
  depths.set(rootId, 0)
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depths.get(current)!
    for (const neighbor of adj.get(current) ?? []) {
      if (!depths.has(neighbor)) {
        depths.set(neighbor, currentDepth + 1)
        queue.push(neighbor)
      }
    }
  }
  return depths
}

export const useStore = create<AppState>()((set) => ({
  ...initialState,

  addNodes: (nodes) =>
    set((state) => ({ nodes: [...state.nodes, ...nodes] })),

  addEdges: (edges) =>
    set((state) => {
      const allEdges = [...state.edges, ...edges]
      return { edges: allEdges, nodeDepths: computeDepths(state.nodes, allEdges) }
    }),

  addNodesAndEdges: (nodes, edges) =>
    set((state) => {
      const allNodes = [...state.nodes, ...nodes]
      const allEdges = [...state.edges, ...edges]
      return { nodes: allNodes, edges: allEdges, nodeDepths: computeDepths(allNodes, allEdges) }
    }),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  setSelectedNode: (selectedNode) => set({ selectedNode }),

  setExplorationActive: (id) =>
    set((state) => {
      const next = new Set(state.activeExplorations)
      next.add(id)
      return { activeExplorations: next }
    }),

  setExplorationComplete: (id) =>
    set((state) => {
      const next = new Set(state.activeExplorations)
      next.delete(id)
      return { activeExplorations: next }
    }),

  clearAllExplorations: () => set({ activeExplorations: new Set<string>() }),

  setSendWsMessage: (fn) => set({ sendWsMessage: fn }),

  addCombo: (comboId, label) =>
    set((state) => ({ combos: [...state.combos, { comboId, label }] })),

  setNodeComboBatch: (entries) =>
    set((state) => {
      const next = new Map(state.nodeToCombo)
      for (const [nodeId, comboId] of entries) {
        next.set(nodeId, comboId)
      }
      return { nodeToCombo: next }
    }),

  setFrontierPapers: (frontierId, papers) =>
    set((state) => {
      const next = new Map(state.frontierPapers)
      next.set(frontierId, papers)
      return { frontierPapers: next }
    }),

  addError: (message) =>
    set((state) => ({
      errors: [...state.errors, { id: crypto.randomUUID(), message }],
    })),

  dismissError: (id) =>
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    })),

  reset: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      activeExplorations: new Set<string>(),
      selectedNode: null,
      sessionId: state.sessionId,
      combos: [],
      nodeToCombo: new Map<string, string>(),
      frontierPapers: new Map<string, PaperType[]>(),
      errors: [],
      nodeDepths: new Map<string, number>(),
    })),
}))
