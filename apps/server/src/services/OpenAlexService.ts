import { Context, Config, Effect, Layer, Option, Schema, Schedule } from "effect"
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform"
import type { Researcher, Paper } from "@research-web/shared"
import { ApiError } from "../errors.js"

// ---------------------------------------------------------------------------
// Public interface & tag
// ---------------------------------------------------------------------------

export interface OpenAlexServiceI {
  readonly searchAuthor: (query: string) => Effect.Effect<Researcher, ApiError>
  readonly getAuthorPapers: (authorId: string) => Effect.Effect<readonly Paper[], ApiError>
  readonly batchGetPapers: (paperIds: readonly string[]) => Effect.Effect<readonly Paper[], ApiError>
  readonly getCitations: (paperId: string) => Effect.Effect<readonly Paper[], ApiError>
  readonly getReferences: (paperId: string) => Effect.Effect<readonly Paper[], ApiError>
}

export class OpenAlexService extends Context.Tag("OpenAlexService")<
  OpenAlexService,
  OpenAlexServiceI
>() {}

export const OpenAlexServiceStub = Layer.succeed(OpenAlexService, {
  searchAuthor: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  getAuthorPapers: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  batchGetPapers: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  getCitations: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
  getReferences: () => Effect.fail(new ApiError({ message: "OpenAlex not implemented" })),
})

// ---------------------------------------------------------------------------
// Internal OpenAlex response schemas
// ---------------------------------------------------------------------------

const OAAuthor = Schema.Struct({
  id: Schema.String,
  display_name: Schema.String,
  affiliations: Schema.optional(Schema.Array(Schema.Struct({
    institution: Schema.Struct({ display_name: Schema.String }),
  }))),
  works_count: Schema.Number,
  cited_by_count: Schema.Number,
  summary_stats: Schema.Struct({ h_index: Schema.Number }),
})

const OAAuthorSearchResponse = Schema.Struct({
  results: Schema.Array(OAAuthor),
})

const OAWork = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  abstract_inverted_index: Schema.NullOr(
    Schema.Record({ key: Schema.String, value: Schema.Array(Schema.Number) })
  ),
  publication_year: Schema.NullOr(Schema.Number),
  cited_by_count: Schema.Number,
  authorships: Schema.Array(Schema.Struct({
    author: Schema.Struct({ id: Schema.NullOr(Schema.String), display_name: Schema.NullOr(Schema.String) }),
  })),
  topics: Schema.optional(Schema.Array(Schema.Struct({ display_name: Schema.String }))),
})

const OAWorksResponse = Schema.Struct({
  results: Schema.Array(OAWork),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stripOAPrefix = (url: string): string =>
  url.replace("https://openalex.org/", "")

const reconstructAbstract = (
  invertedIndex: Record<string, readonly number[]> | null
): string | null => {
  if (!invertedIndex) return null
  const pairs: Array<[string, number]> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      pairs.push([word, pos])
    }
  }
  pairs.sort((a, b) => a[1] - b[1])
  return pairs.map(([word]) => word).join(" ")
}

// ---------------------------------------------------------------------------
// Mapping helpers (pure)
// ---------------------------------------------------------------------------

type OAAuthorType = typeof OAAuthor.Type
type OAWorkType = typeof OAWork.Type

const mapOAAuthor = (a: OAAuthorType): Researcher => ({
  id: stripOAPrefix(a.id),
  name: a.display_name,
  affiliations: (a.affiliations ?? []).map((aff) => aff.institution.display_name),
  paperCount: a.works_count,
  citationCount: a.cited_by_count,
  hIndex: a.summary_stats.h_index,
})

const mapOAWork = (w: OAWorkType & { title: string }): Paper => ({
  id: stripOAPrefix(w.id),
  title: w.title,
  abstract: Option.fromNullable(reconstructAbstract(w.abstract_inverted_index)),
  year: w.publication_year ?? 0,
  citationCount: w.cited_by_count,
  authors: w.authorships
    .filter((a): a is typeof a & { author: { id: string; display_name: string } } =>
      a.author.id != null && a.author.display_name != null)
    .map((a) => ({
      id: stripOAPrefix(a.author.id),
      name: a.author.display_name,
    })),
  fieldsOfStudy: (w.topics ?? []).map((t) => t.display_name),
  tldr: Option.none(),
})

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.openalex.org"

const AUTHOR_SELECT = "id,display_name,affiliations,works_count,cited_by_count,summary_stats"
const WORK_SELECT = "id,title,abstract_inverted_index,publication_year,cited_by_count,authorships,topics"

const retryPolicy = Schedule.intersect(
  Schedule.exponential("1 second"),
  Schedule.recurs(3),
)

const toApiError = (e: unknown): ApiError =>
  new ApiError({ message: e instanceof Error ? e.message : String(e) })

export const OpenAlexServiceLive = Layer.effect(
  OpenAlexService,
  Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient
    const apiKey = yield* Config.string("OPENALEX_API_KEY").pipe(Config.withDefault(""))

    const client = baseClient.pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(BASE_URL)),
    )

    const fetchJson = <A, I>(url: string, schema: Schema.Schema<A, I>) => {
      const separator = url.includes("?") ? "&" : "?"
      const authUrl = apiKey !== "" ? `${url}${separator}api_key=${apiKey}` : url
      return client.get(authUrl).pipe(
        Effect.flatMap((response) => {
          if (response.status === 429) {
            return Effect.fail(new ApiError({ message: "Rate limited by OpenAlex API", status: 429 }))
          }
          if (response.status < 200 || response.status >= 300) {
            return Effect.fail(
              new ApiError({ message: `OpenAlex API error: ${response.status}`, status: response.status })
            )
          }
          return HttpClientResponse.schemaBodyJson(schema)(response).pipe(
            Effect.mapError(toApiError)
          )
        }),
        Effect.mapError((e) => e instanceof ApiError ? e : toApiError(e)),
        Effect.retry(
          retryPolicy.pipe(Schedule.whileInput((err: ApiError) => err.status === 429))
        ),
        Effect.scoped,
      )
    }

    return OpenAlexService.of({
      searchAuthor: (query) =>
        fetchJson(
          `/authors?search=${encodeURIComponent(query)}&sort=works_count:desc&per_page=1&select=${AUTHOR_SELECT}`,
          OAAuthorSearchResponse,
        ).pipe(
          Effect.flatMap((res) => {
            if (res.results.length === 0) {
              return Effect.fail(new ApiError({ message: `No author found for "${query}"` }))
            }
            return Effect.succeed(mapOAAuthor(res.results[0]))
          })
        ),

      getAuthorPapers: (authorId) =>
        fetchJson(
          `/works?filter=authorships.author.id:${encodeURIComponent(authorId)}&sort=publication_date:desc&per_page=100&select=${WORK_SELECT}`,
          OAWorksResponse,
        ).pipe(Effect.map((res) => res.results.filter((w): w is OAWorkType & { title: string } => w.title != null).map(mapOAWork))),

      batchGetPapers: (paperIds) => {
        if (paperIds.length === 0) return Effect.succeed([])
        const filter = paperIds.map((id) => encodeURIComponent(id)).join("|")
        return fetchJson(
          `/works?filter=openalex:${filter}&per_page=100&select=${WORK_SELECT}`,
          OAWorksResponse,
        ).pipe(Effect.map((res) => res.results.filter((w): w is OAWorkType & { title: string } => w.title != null).map(mapOAWork)))
      },

      getCitations: (paperId) =>
        fetchJson(
          `/works?filter=cites:${encodeURIComponent(paperId)},from_publication_date:2023-01-01&sort=publication_date:desc&per_page=100&select=${WORK_SELECT}`,
          OAWorksResponse,
        ).pipe(Effect.map((res) => res.results.filter((w): w is OAWorkType & { title: string } => w.title != null).map(mapOAWork))),

      getReferences: (paperId) =>
        fetchJson(
          `/works?filter=cited_by:${encodeURIComponent(paperId)},from_publication_date:2023-01-01&sort=publication_date:desc&per_page=100&select=${WORK_SELECT}`,
          OAWorksResponse,
        ).pipe(Effect.map((res) => res.results.filter((w): w is OAWorkType & { title: string } => w.title != null).map(mapOAWork))),
    })
  }),
)
