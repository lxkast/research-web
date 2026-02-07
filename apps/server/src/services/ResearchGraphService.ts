import { Context, Effect, Layer } from "effect"
import type { Researcher, Paper, Frontier } from "@research-web/shared"

export interface ResearchGraphServiceI {
  readonly addResearcher: (researcher: Researcher) => Effect.Effect<void>
  readonly addFrontiers: (frontiers: readonly Frontier[]) => Effect.Effect<void>
  readonly getFrontier: (frontierId: string) => Effect.Effect<Frontier>
  readonly addPapers: (frontierId: string, papers: readonly Paper[]) => Effect.Effect<void>
}

export class ResearchGraphService extends Context.Tag("ResearchGraphService")<
  ResearchGraphService,
  ResearchGraphServiceI
>() {}

export const ResearchGraphServiceStub = Layer.succeed(ResearchGraphService, {
  addResearcher: () => Effect.die("not implemented"),
  addFrontiers: () => Effect.die("not implemented"),
  getFrontier: () => Effect.die("not implemented"),
  addPapers: () => Effect.die("not implemented"),
})
