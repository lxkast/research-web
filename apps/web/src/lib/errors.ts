import { Data } from "effect"

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string
  readonly status?: number
}> {}

export class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly message: string
  readonly raw: unknown
}> {}
