import { describe, test, expect } from "vitest"
import { Option } from "effect"
import { dispatchServerMessage } from "../useWebSocket.ts"
import { useStore } from "../../store/index.ts"
import type { ServerMessageType, GraphNodeType, GraphEdgeType } from "@research-web/shared"

const researcherNode: GraphNodeType = {
  type: "researcher",
  data: { id: "r1", name: "Alice", affiliations: [], paperCount: 10, citationCount: 100, hIndex: 5 },
}

const frontierNode: GraphNodeType = {
  type: "frontier",
  data: { id: "f1", label: "Quantum Computing", summary: "Frontier desc", paperIds: [], parentId: Option.none() },
}

const edge: GraphEdgeType = {
  source: "r1",
  target: "f1",
  type: "has_frontier",
}

describe("dispatchServerMessage", () => {
  test("researcher_found adds node to store", () => {
    const msg: ServerMessageType = { type: "researcher_found", node: researcherNode }
    dispatchServerMessage(msg)

    const { nodes } = useStore.getState()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual(researcherNode)
  })

  test("frontiers_discovered adds nodes and edges to store", () => {
    const msg: ServerMessageType = {
      type: "frontiers_discovered",
      nodes: [frontierNode],
      edges: [edge],
      parentId: Option.none(),
    }
    dispatchServerMessage(msg)

    const { nodes, edges } = useStore.getState()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual(frontierNode)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toEqual(edge)
  })

  test("papers_collected adds nodes and edges to store", () => {
    const paperNode: GraphNodeType = {
      type: "paper",
      data: { id: "p1", title: "Paper 1", year: 2024, authors: [], citationCount: 5, fieldsOfStudy: [], abstract: Option.none(), tldr: Option.none() },
    }
    const paperEdge: GraphEdgeType = {
      source: "f1",
      target: "p1",
      type: "has_paper",
    }
    const msg: ServerMessageType = {
      type: "papers_collected",
      nodes: [paperNode],
      edges: [paperEdge],
      frontierId: "f1",
    }
    dispatchServerMessage(msg)

    const { nodes, edges } = useStore.getState()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual(paperNode)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toEqual(paperEdge)
  })

  test("exploration_complete removes exploration from activeExplorations", () => {
    useStore.getState().setExplorationActive("exp-1")
    expect(useStore.getState().activeExplorations.has("exp-1")).toBe(true)

    const msg: ServerMessageType = { type: "exploration_complete", explorationId: "exp-1" }
    dispatchServerMessage(msg)

    expect(useStore.getState().activeExplorations.has("exp-1")).toBe(false)
  })
})
