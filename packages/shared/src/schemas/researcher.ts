import { Schema } from "effect"

export const Researcher = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  affiliations: Schema.Array(Schema.String),
  paperCount: Schema.Number,
  citationCount: Schema.Number,
  hIndex: Schema.Number,
})

export type Researcher = typeof Researcher.Type

export const Paper = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  doi: Schema.optional(Schema.String),
  abstract: Schema.optionalWith(Schema.String, { as: "Option" }),
  year: Schema.Number,
  citationCount: Schema.Number,
  authors: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  fieldsOfStudy: Schema.Array(Schema.String),
  tldr: Schema.optionalWith(Schema.String, { as: "Option" }),
})

export type Paper = typeof Paper.Type

export const Frontier = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  summary: Schema.String,
  paperIds: Schema.Array(Schema.String),
  parentId: Schema.optionalWith(Schema.String, { as: "Option" }),
})

export type Frontier = typeof Frontier.Type
