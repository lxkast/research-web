import { Schema } from "effect"
import { Researcher, Paper, Frontier } from "./researcher.js"

export const GraphNode = Schema.Union(
  Schema.Struct({ type: Schema.Literal("researcher"), data: Researcher }),
  Schema.Struct({ type: Schema.Literal("frontier"), data: Frontier }),
  Schema.Struct({ type: Schema.Literal("paper"), data: Paper }),
  Schema.Struct({
    type: Schema.Literal("contributor"),
    data: Schema.Struct({ id: Schema.String, name: Schema.String }),
  }),
)

export type GraphNode = typeof GraphNode.Type

export const GraphEdge = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  type: Schema.Literal(
    "has_frontier",
    "has_subfrontier",
    "has_paper",
    "has_contributor"
  ),
})

export type GraphEdge = typeof GraphEdge.Type
