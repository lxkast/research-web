import { Context, Effect, Layer } from "effect"
import type { LlmError } from "../errors.js"

export interface LlmServiceI {
  readonly complete: (prompt: string) => Effect.Effect<string, LlmError>
}

export class LlmService extends Context.Tag("LlmService")<
  LlmService,
  LlmServiceI
>() {}

export const LlmServiceStub = Layer.succeed(LlmService, {
  complete: () => Effect.die("not implemented"),
})
