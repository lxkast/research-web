import { Context, Config, Effect, Layer, Option, Schema, Schedule } from "effect"
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpBody,
} from "@effect/platform"
import type { Researcher, Paper } from "@research-web/shared"
import { ApiError } from "../errors.js"

// ---------------------------------------------------------------------------
// Public interface & tag
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal S2 response schemas
// ---------------------------------------------------------------------------

const S2Author = Schema.Struct({
  authorId: Schema.String,
  name: Schema.String,
  affiliations: Schema.NullOr(Schema.Array(Schema.String)),
  paperCount: Schema.Number,
  citationCount: Schema.Number,
  hIndex: Schema.Number,
})

const S2AuthorSearchResponse = Schema.Struct({
  total: Schema.Number,
  data: Schema.Array(S2Author),
})

const S2Tldr = Schema.Struct({
  text: Schema.String,
})

const S2PaperAuthor = Schema.Struct({
  authorId: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
})

const S2Paper = Schema.Struct({
  paperId: Schema.String,
  title: Schema.String,
  abstract: Schema.NullOr(Schema.String),
  year: Schema.NullOr(Schema.Number),
  citationCount: Schema.Number,
  authors: Schema.NullOr(Schema.Array(S2PaperAuthor)),
  fieldsOfStudy: Schema.NullOr(Schema.Array(Schema.String)),
  tldr: Schema.optional(Schema.NullOr(S2Tldr)),
})

const S2AuthorPapersResponse = Schema.Struct({
  data: Schema.Array(S2Paper),
})

const S2CitationsResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ citingPaper: S2Paper })),
})

const S2ReferencesResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ citedPaper: S2Paper })),
})

const S2BatchResponseItem = Schema.NullOr(S2Paper)
const S2BatchResponse = Schema.Array(S2BatchResponseItem)

// ---------------------------------------------------------------------------
// Mapping helpers (pure)
// ---------------------------------------------------------------------------

type S2AuthorType = typeof S2Author.Type
type S2PaperType = typeof S2Paper.Type

const mapS2Author = (a: S2AuthorType): Researcher => ({
  id: a.authorId,
  name: a.name,
  affiliations: a.affiliations ?? [],
  paperCount: a.paperCount,
  citationCount: a.citationCount,
  hIndex: a.hIndex,
})

const mapS2Paper = (p: S2PaperType): Paper => ({
  id: p.paperId,
  title: p.title,
  abstract: Option.fromNullable(p.abstract),
  year: p.year ?? 0,
  citationCount: p.citationCount,
  authors: (p.authors ?? [])
    .filter((a): a is { authorId: string; name: string } => a.authorId != null && a.name != null)
    .map((a) => ({ id: a.authorId, name: a.name })),
  fieldsOfStudy: p.fieldsOfStudy ?? [],
  tldr: Option.fromNullable(p.tldr?.text),
})

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.semanticscholar.org/graph/v1"

const AUTHOR_FIELDS = "authorId,name,affiliations,paperCount,citationCount,hIndex"
const PAPER_FIELDS = "paperId,title,abstract,year,citationCount,authors,fieldsOfStudy"
const PAPER_FIELDS_BATCH = "paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,tldr"
const CITATION_FIELDS = "paperId,title,abstract,year,citationCount,authors"

const retryPolicy = Schedule.intersect(
  Schedule.exponential("1 second"),
  Schedule.recurs(3)
)

const toApiError = (e: unknown): ApiError =>
  new ApiError({ message: e instanceof Error ? e.message : String(e) })

export const SemanticScholarServiceLive = Layer.effect(
  SemanticScholarService,
  Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient
    const apiKey = yield* Config.string("S2_API_KEY").pipe(Config.withDefault(""))

    const client = baseClient.pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(BASE_URL)),
      apiKey !== ""
        ? HttpClient.mapRequest(HttpClientRequest.setHeader("x-api-key", apiKey))
        : (c: typeof baseClient) => c
    )

    const fetchJson = <A, I>(url: string, schema: Schema.Schema<A, I>) =>
      client.get(url).pipe(
        Effect.flatMap((response) => {
          if (response.status === 429) {
            return Effect.fail(new ApiError({ message: "Rate limited by S2 API", status: 429 }))
          }
          if (response.status < 200 || response.status >= 300) {
            return Effect.fail(
              new ApiError({ message: `S2 API error: ${response.status}`, status: response.status })
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
        Effect.scoped
      )

    const fetchJsonPost = <A, I>(url: string, body: unknown, schema: Schema.Schema<A, I>) =>
      Effect.gen(function* () {
        const request = HttpClientRequest.post(url).pipe(
          HttpClientRequest.prependUrl(BASE_URL),
          apiKey !== "" ? HttpClientRequest.setHeader("x-api-key", apiKey) : (r) => r,
          HttpClientRequest.setBody(HttpBody.unsafeJson(body))
        )
        const response = yield* baseClient.execute(request).pipe(
          Effect.mapError(toApiError)
        )
        if (response.status === 429) {
          return yield* Effect.fail(new ApiError({ message: "Rate limited by S2 API", status: 429 }))
        }
        if (response.status < 200 || response.status >= 300) {
          console.error(`[S2] POST ${url} → ${response.status}`)
          return yield* Effect.fail(
            new ApiError({ message: `S2 API error: ${response.status}`, status: response.status })
          )
        }
        return yield* HttpClientResponse.schemaBodyJson(schema)(response).pipe(
          Effect.mapError(toApiError)
        )
      }).pipe(
        Effect.retry(
          retryPolicy.pipe(Schedule.whileInput((err: ApiError) => err.status === 429))
        ),
        Effect.scoped
      )

    return SemanticScholarService.of({
      searchAuthor: (query) =>
        fetchJson(
          `/author/search?query=${encodeURIComponent(query)}&fields=${AUTHOR_FIELDS}&limit=100`,
          S2AuthorSearchResponse
        ).pipe(
          Effect.flatMap((res) => {
            if (res.data.length === 0) {
              return Effect.fail(new ApiError({ message: `No author found for "${query}"` }))
            }
            const best = res.data.reduce((a, b) => (b.paperCount > a.paperCount ? b : a))
            return Effect.succeed(mapS2Author(best))
          })
        ),

      getAuthorPapers: (authorId) =>
        fetchJson(
          `/author/${encodeURIComponent(authorId)}/papers?fields=${PAPER_FIELDS}&limit=100`,
          S2AuthorPapersResponse
        ).pipe(Effect.map((res) => res.data.map(mapS2Paper))),

      batchGetPapers: (paperIds) =>
        fetchJsonPost(
          `/paper/batch?fields=${PAPER_FIELDS_BATCH}`,
          { ids: paperIds },
          S2BatchResponse
        ).pipe(Effect.map((papers) => papers.filter((p): p is S2PaperType => p !== null).map(mapS2Paper))),

      getCitations: (paperId) =>
        fetchJson(
          `/paper/${encodeURIComponent(paperId)}/citations?fields=${CITATION_FIELDS}&limit=100`,
          S2CitationsResponse
        ).pipe(Effect.map((res) => res.data.map((d) => mapS2Paper(d.citingPaper)))),

      getReferences: (paperId) =>
        fetchJson(
          `/paper/${encodeURIComponent(paperId)}/references?fields=${CITATION_FIELDS}&limit=100`,
          S2ReferencesResponse
        ).pipe(Effect.map((res) => res.data.map((d) => mapS2Paper(d.citedPaper)))),
    })
  })
)
