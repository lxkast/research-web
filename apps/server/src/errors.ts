import { Data } from "effect"

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string
  readonly status?: number
}> {}

export class LlmError extends Data.TaggedError("LlmError")<{
  readonly message: string
}> {}

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string
  readonly raw: unknown
}> {}
