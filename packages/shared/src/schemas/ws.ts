import { Schema } from "effect"
import { GraphNode, GraphEdge } from "./graph.js"

export const ClientMessage = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("expand"),
    frontierId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("elaborate"),
    frontierId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("stop"),
  }),
)

export type ClientMessage = typeof ClientMessage.Type

export const ServerMessage = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("researcher_found"),
    node: GraphNode,
  }),
  Schema.Struct({
    type: Schema.Literal("frontiers_discovered"),
    nodes: Schema.Array(GraphNode),
    edges: Schema.Array(GraphEdge),
    parentId: Schema.optionalWith(Schema.String, { as: "Option" }),
  }),
  Schema.Struct({
    type: Schema.Literal("papers_collected"),
    nodes: Schema.Array(GraphNode),
    edges: Schema.Array(GraphEdge),
    frontierId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("exploration_complete"),
    explorationId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("exploration_cancelled"),
  }),
  Schema.Struct({
    type: Schema.Literal("error"),
    message: Schema.String,
  }),
)

export type ServerMessage = typeof ServerMessage.Type
