import { Context, Effect, Layer } from "effect"
import type { Researcher, Paper } from "@research-web/shared"
import { ApiError } from "../errors.js"

export interface OpenAlexServiceI {
  readonly searchAuthor: (query: string) => Effect.Effect<Researcher, ApiError>
  readonly getAuthorPapers: (authorId: string) => Effect.Effect<readonly Paper[], ApiError>
  readonly batchGetPapers: (paperIds: readonly string[]) => Effect.Effect<readonly Paper[], ApiError>
}

export class OpenAlexService extends Context.Tag("OpenAlexService")<
  OpenAlexService,
  OpenAlexServiceI
>() {}

export const OpenAlexServiceStub = Layer.succeed(OpenAlexService, {
  searchAuthor: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  getAuthorPapers: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  batchGetPapers: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
})
