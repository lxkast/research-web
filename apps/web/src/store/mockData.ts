import { Option } from "effect"
import type { GraphNodeType, GraphEdgeType } from "@research-web/shared"

const researcherId = "r-hinton"

export const mockNodes: GraphNodeType[] = [
  {
    type: "researcher",
    data: {
      id: researcherId,
      name: "Geoffrey Hinton",
      affiliations: ["University of Toronto", "Google Brain"],
      paperCount: 382,
      citationCount: 498230,
      hIndex: 176,
    },
  },
  {
    type: "frontier",
    data: {
      id: "f-1",
      label: "Capsule Networks",
      summary:
        "Dynamic routing between capsules for better spatial hierarchy representation in neural networks.",
      paperIds: ["p-1", "p-2"],
      parentId: Option.none(),
    },
  },
  {
    type: "frontier",
    data: {
      id: "f-2",
      label: "Boltzmann Machines",
      summary:
        "Stochastic generative models using energy-based learning for unsupervised feature discovery.",
      paperIds: ["p-3", "p-4"],
      parentId: Option.none(),
    },
  },
  {
    type: "frontier",
    data: {
      id: "f-3",
      label: "Knowledge Distillation",
      summary:
        "Training smaller student networks to mimic larger teacher networks for model compression.",
      paperIds: ["p-5"],
      parentId: Option.none(),
    },
  },
  {
    type: "frontier",
    data: {
      id: "f-4",
      label: "Forward-Forward Algorithm",
      summary:
        "A novel learning procedure that replaces backpropagation with two forward passes using positive and negative data.",
      paperIds: ["p-6"],
      parentId: Option.none(),
    },
  },
]

export const mockEdges: GraphEdgeType[] = [
  { source: researcherId, target: "f-1", type: "has_frontier" },
  { source: researcherId, target: "f-2", type: "has_frontier" },
  { source: researcherId, target: "f-3", type: "has_frontier" },
  { source: researcherId, target: "f-4", type: "has_frontier" },
]
