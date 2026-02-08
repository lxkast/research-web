import { Effect, Schema } from "effect"
import { ApiError, DecodeError } from "./errors.ts"

const ExploreResponse = Schema.Struct({ sessionId: Schema.String })

export const explore = (
  name: string,
  sessionId: string
): Effect.Effect<{ sessionId: string }, ApiError | DecodeError> =>
  Effect.gen(function* () {
    const res = yield* Effect.tryPromise({
      try: () =>
        fetch("/api/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, sessionId }),
        }),
      catch: (error) =>
        new ApiError({ message: error instanceof Error ? error.message : "Network error" }),
    })
    if (!res.ok) {
      return yield* new ApiError({
        message: `explore failed: ${res.status} ${res.statusText}`,
        status: res.status,
      })
    }
    const json = yield* Effect.tryPromise({
      try: () => res.json(),
      catch: () => new DecodeError({ message: "Invalid JSON response", raw: null }),
    })
    return yield* Schema.decodeUnknown(ExploreResponse)(json).pipe(
      Effect.mapError(
        (e) => new DecodeError({ message: `Response decode failed: ${e.message}`, raw: json })
      )
    )
  })
