import { Effect, Layer, Option } from "effect"
import { FetchHttpClient } from "@effect/platform"
import { BunRuntime } from "@effect/platform-bun"
import { SemanticScholarService, SemanticScholarServiceLive, type SemanticScholarServiceI } from "../src/services/SemanticScholarService.js"

const testAuthor = (s2: SemanticScholarServiceI, name: string) =>
  Effect.gen(function* () {
    console.log(`\n--- Searching for ${name} ---`)
    const researcher = yield* s2.searchAuthor(name)
    console.log(`Researcher: ${researcher.name}`)
    console.log(`ID: ${researcher.id}`)
    console.log(`Affiliations: ${researcher.affiliations.join(", ") || "(none)"}`)
    console.log(`Papers: ${researcher.paperCount}`)
    console.log(`Citations: ${researcher.citationCount}`)
    console.log(`h-index: ${researcher.hIndex}`)

    console.log("\n--- Fetching papers ---")
    const papers = yield* s2.getAuthorPapers(researcher.id)
    console.log(`Fetched ${papers.length} papers`)

    const sorted = [...papers].sort((a, b) => b.citationCount - a.citationCount)
    if (sorted.length > 0) {
      const top = sorted[0]
      console.log(`\nTop paper: ${top.title} (${top.citationCount} citations)`)
      const abstract = Option.getOrElse(top.abstract, () => "(no abstract)")
      console.log(`Abstract: ${abstract.slice(0, 120)}...`)
    }
  })

const program = Effect.gen(function* () {
  const s2 = yield* SemanticScholarService

  yield* testAuthor(s2, "Geoffrey Hinton")
  yield* testAuthor(s2, "Wayne Luk")

  console.log("\n--- Done ---")
})

const MainLayer = Layer.provide(SemanticScholarServiceLive, FetchHttpClient.layer)

BunRuntime.runMain(program.pipe(Effect.provide(MainLayer)))
