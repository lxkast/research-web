import { create } from "zustand"
import type { GraphNodeType, GraphEdgeType } from "@research-web/shared"

interface AppState {
  sessionId: string
  nodes: GraphNodeType[]
  edges: GraphEdgeType[]
  wsStatus: "disconnected" | "connecting" | "connected"
  activeExplorations: Set<string>
  selectedNode: string | null

  addNodes: (nodes: GraphNodeType[]) => void
  addEdges: (edges: GraphEdgeType[]) => void
  setWsStatus: (status: AppState["wsStatus"]) => void
  setSelectedNode: (id: string | null) => void
  setExplorationActive: (id: string) => void
  setExplorationComplete: (id: string) => void
  reset: () => void
}

const initialState = {
  sessionId: crypto.randomUUID(),
  nodes: [] as GraphNodeType[],
  edges: [] as GraphEdgeType[],
  wsStatus: "disconnected" as const,
  activeExplorations: new Set<string>(),
  selectedNode: null as string | null,
}

export const useStore = create<AppState>()((set) => ({
  ...initialState,

  addNodes: (nodes) =>
    set((state) => ({ nodes: [...state.nodes, ...nodes] })),

  addEdges: (edges) =>
    set((state) => ({ edges: [...state.edges, ...edges] })),

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

  reset: () =>
    set((state) => ({
      nodes: [],
      edges: [],
      activeExplorations: new Set<string>(),
      selectedNode: null,
      sessionId: state.sessionId,
    })),
}))
