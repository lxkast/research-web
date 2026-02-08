import { Context, Config, Effect, Layer } from "effect"
import Anthropic from "@anthropic-ai/sdk"
import { LlmError } from "../errors.js"

export interface LlmServiceI {
  readonly complete: (systemPrompt: string, userPrompt: string) => Effect.Effect<string, LlmError>
}

export class LlmService extends Context.Tag("LlmService")<
  LlmService,
  LlmServiceI
>() {}

export const LlmServiceStub = Layer.succeed(LlmService, {
  complete: () => Effect.die("not implemented"),
})

export const LlmServiceLive = Layer.effect(
  LlmService,
  Effect.gen(function* () {
    const apiKey = yield* Config.string("ANTHROPIC_API_KEY")
    const client = new Anthropic({ apiKey })

    return {
      complete: (systemPrompt, userPrompt) =>
        Effect.tryPromise({
          try: () =>
            client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }],
            }),
          catch: (e) => new LlmError({ message: e instanceof Error ? e.message : String(e) }),
        }).pipe(
          Effect.flatMap((response) => {
            const textBlock = response.content.find((b) => b.type === "text")
            if (!textBlock || textBlock.type !== "text") {
              return Effect.fail(new LlmError({ message: "No text block in LLM response" }))
            }
            return Effect.succeed(textBlock.text)
          })
        ),
    }
  })
)
