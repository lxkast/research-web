import { Context, Effect, Layer } from "effect"
import type { Researcher, Paper } from "@research-web/shared"
import type { ApiError } from "../errors.js"

export interface SemanticScholarServiceI {
  readonly searchAuthor: (query: string) => Effect.Effect<Researcher, ApiError>
  readonly getAuthorPapers: (authorId: string) => Effect.Effect<readonly Paper[], ApiError>
  readonly batchGetPapers: (paperIds: readonly string[]) => Effect.Effect<readonly Paper[], ApiError>
  readonly getCitations: (paperId: string) => Effect.Effect<readonly Paper[], ApiError>
  readonly getReferences: (paperId: string) => Effect.Effect<readonly Paper[], ApiError>
}

export class SemanticScholarService extends Context.Tag("SemanticScholarService")<
  SemanticScholarService,
  SemanticScholarServiceI
>() {}

export const SemanticScholarServiceStub = Layer.succeed(SemanticScholarService, {
  searchAuthor: () => Effect.die("not implemented"),
  getAuthorPapers: () => Effect.die("not implemented"),
  batchGetPapers: () => Effect.die("not implemented"),
  getCitations: () => Effect.die("not implemented"),
  getReferences: () => Effect.die("not implemented"),
})
