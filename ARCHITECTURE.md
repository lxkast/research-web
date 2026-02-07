# Architecture: Research Intelligence Engine

A tool that takes a researcher's name and produces an interactive, graph-based map of their research landscape. An agentic swarm fans out recursively — discovering research frontiers, expanding into adjacent fields, and elaborating with papers and contributors.

Three core interactions drive exploration:

1. **Search** — enter a researcher name, get their clustered research frontiers
2. **Expand** — click a frontier to discover sub-frontiers beyond the original researcher
3. **Elaborate** — click a frontier to reveal its papers and key contributors

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User (Browser)                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    React 19 + Vite 6 SPA                      │  │
│  │                                                               │  │
│  │  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │  │
│  │  │  Zustand     │   │  WebSocket   │   │  @antv/g6 v5     │  │  │
│  │  │  Store       │◄──│  Hook        │   │  Graph Canvas    │  │  │
│  │  │             │   │              │   │  + React Nodes   │  │  │
│  │  └──────┬──────┘   └──────▲───────┘   └──────────────────┘  │  │
│  │         │                 │                                   │  │
│  └─────────┼─────────────────┼───────────────────────────────────┘  │
└────────────┼─────────────────┼──────────────────────────────────────┘
             │                 │
     REST POST /api/explore    │  WebSocket (bidirectional)
             │                 │
┌────────────▼─────────────────▼──────────────────────────────────────┐
│                      Bun + Effect.ts Server                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Orchestrator                              │   │
│  │  Dispatches agents as Effect Fibers · Tracks active sessions  │   │
│  └──────┬──────────────┬──────────────────┬─────────────────────┘   │
│         │              │                  │                          │
│  ┌──────▼──────┐ ┌─────▼────────┐ ┌──────▼──────────┐              │
│  │  Frontier   │ │  Frontier    │ │  Paper          │              │
│  │  Discovery  │ │  Expander    │ │  Collector      │              │
│  └──────┬──────┘ └──────┬───────┘ └──────┬──────────┘              │
│         │               │                │                          │
│  ┌──────▼───────────────▼────────────────▼──────────────────────┐   │
│  │                    Service Layer                               │   │
│  │  SemanticScholar · OpenAlex · LlmService · ResearchGraph     │   │
│  │  WebSocketHub                                                 │   │
│  └──────┬───────────────┬────────────────────────────────────────┘   │
└─────────┼───────────────┼───────────────────────────────────────────┘
          │               │
          ▼               ▼
  ┌───────────────┐ ┌──────────┐
  │ Semantic      │ │ Anthropic│
  │ Scholar API   │ │ Claude   │
  │ + OpenAlex    │ │ Haiku    │
  └───────────────┘ └──────────┘
```

---

## Monorepo Structure

```
research-web/
├── package.json              # Workspace root
├── pnpm-workspace.yaml       # pnpm workspaces config
├── turbo.json                # Turborepo pipeline
├── tsconfig.base.json        # Shared TS config
│
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── schemas/
│           │   ├── researcher.ts   # Researcher, Paper, Frontier schemas
│           │   ├── graph.ts        # GraphNode, GraphEdge schemas
│           │   └── ws.ts           # WebSocket event schemas (client + server)
│           └── index.ts
│
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── SearchBar.tsx
│   │       │   ├── GraphCanvas.tsx      # G6 graph wrapper
│   │       │   ├── nodes/
│   │       │   │   ├── FrontierNode.tsx  # React-rendered G6 node
│   │       │   │   ├── PaperNode.tsx
│   │       │   │   └── ResearcherNode.tsx
│   │       │   └── Toolbar.tsx
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts      # WS connection + message dispatch
│   │       │   └── useGraph.ts          # G6 instance management
│   │       ├── store/
│   │       │   └── index.ts             # Zustand store
│   │       └── lib/
│   │           └── api.ts               # REST client (initial search)
│   │
│   └── server/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts                  # Entry point, Layer composition
│           ├── api/
│           │   └── routes.ts            # HttpApi route definitions
│           ├── agents/
│           │   ├── Orchestrator.ts
│           │   ├── FrontierDiscovery.ts
│           │   ├── FrontierExpander.ts
│           │   ├── PaperCollector.ts
│           │   └── Synthesizer.ts       # LLM utility (used by other agents)
│           └── services/
│               ├── SemanticScholarService.ts
│               ├── OpenAlexService.ts
│               ├── LlmService.ts
│               ├── ResearchGraphService.ts
│               └── WebSocketHubService.ts
```

Managed with **pnpm workspaces** for dependency hoisting and **Turborepo** for build orchestration (`turbo dev` runs both apps in parallel).

---

## Frontend Architecture

### React 19 + Vite 6

Single-page application. No SSR — this is a client-heavy interactive visualization, not a content site. Vite provides fast HMR during development and optimized builds.

### Graph Visualization: @antv/g6 v5

G6 was chosen for its native support for the interaction model this app needs:

| Feature | @antv/g6 v5 | react-force-graph | Cytoscape.js | D3 (manual) |
|---|---|---|---|---|
| Combo grouping (Elaborate) | Built-in | No | Manual plugins | Manual |
| CollapseExpand behavior | Built-in | No | Extension | Manual |
| React node rendering | @antv/g6-extension-react | Native (Three.js) | No | Manual (foreignObject) |
| Incremental graph updates | Supported | Full re-render | Supported | Manual |
| Layout algorithms | Multiple built-in | Force only | Multiple | Manual |

Key G6 features used:

- **Combo nodes** — when the user Elaborates a frontier, papers and contributors appear as children inside a Combo group, visually nesting them under the frontier
- **CollapseExpand behavior** — built-in interaction to expand/collapse Combos
- **React node rendering** — via `@antv/g6-extension-react`, each graph node is a React component with rich UI (citation counts, summaries, action buttons)
- **Incremental data updates** — as agents stream results via WebSocket, nodes are added to the graph without a full re-render

### Zustand Store

```
GraphStore
├── nodes: GraphNode[]           # Current graph nodes
├── edges: GraphEdge[]           # Current graph edges
├── activeExplorations: Set      # In-flight agent operations
├── wsStatus: 'connecting' | 'connected' | 'disconnected'
├── selectedNode: string | null
│
├── actions:
│   ├── addNodes(nodes)          # Append from WS events
│   ├── addEdges(edges)
│   ├── setExplorationActive(id)
│   ├── setExplorationComplete(id)
│   └── reset()
```

Zustand over Redux/Context: minimal boilerplate, no providers, works well with external systems (G6 instance reads from store directly).

### WebSocket Hook

`useWebSocket` manages the connection lifecycle and dispatches incoming server events to Zustand actions:

- `frontiers_discovered` → `addNodes` + `addEdges`
- `papers_collected` → `addNodes` + `addEdges` (as Combo children)
- `researcher_found` → `addNodes`
- `exploration_complete` → `setExplorationComplete`

Outgoing commands: `expand`, `elaborate`, `stop`.

---

## Backend Architecture

### Bun Runtime

Bun provides native TypeScript execution (no transpile step), fast startup, and built-in WebSocket support. The entire server runs as a single Bun process.

### @effect/platform HttpApi

HTTP routes are defined using `@effect/platform`'s `HttpApi` module — native Effect integration without needing Express, Fastify, or Hono. Routes are Effect programs that compose naturally with the service layer.

```
POST /api/explore   { name: string }  →  Kicks off exploration, returns session ID
GET  /api/health                      →  Health check
WS   /ws                              →  Bidirectional WebSocket
```

The REST endpoint exists only for the initial search (so the frontend gets a session ID). All subsequent communication is WebSocket.

### Service Layer

All services are defined as Effect `Context.Tag` with `Layer` implementations:

| Service | Responsibility |
|---|---|
| `SemanticScholarService` | Author search, paper fetch, citation/reference traversal, batch API |
| `OpenAlexService` | Fallback academic data source when S2 rate-limits or lacks data |
| `LlmService` | Claude Haiku calls via Anthropic SDK, structured JSON output |
| `ResearchGraphService` | In-memory graph state per session (nodes, edges, frontiers) |
| `WebSocketHubService` | PubSub fan-out — broadcast events to connected clients by session |

---

## Agent Swarm Architecture

Agents are pure Effect functions — no internal mutable state. They read from and write to services. The Orchestrator dispatches them as Effect Fibers for concurrency and cancellation.

### Orchestrator

The root coordinator. Not an agent itself — the dispatch layer.

- Receives user commands (`search`, `expand`, `elaborate`) from the WebSocket handler
- Dispatches the appropriate sub-agent as a forked Effect Fiber
- Tracks active Fibers per session so the user can cancel in-flight work
- Does **not** call APIs or LLMs directly — purely coordination

### FrontierDiscovery

Identifies research frontiers for a researcher.

**Input:** Researcher ID (from Semantic Scholar)

**Pipeline:**
1. Fetch the researcher's papers via `SemanticScholarService` (title, abstract, fieldsOfStudy, citationCount)
2. Sort by citation impact, take top ~30 papers
3. Send paper titles + abstracts to LLM with a structured prompt: *"Cluster these papers into 4–6 thematic research frontiers"*
4. LLM returns structured JSON: `[{ label, summary, paperIds }]`
5. Write frontier nodes + edges to `ResearchGraphService`
6. Broadcast `frontiers_discovered` via `WebSocketHubService`

**Concurrency:** Single sequential pipeline (API call → LLM call → write).

### FrontierExpander

Recursively discovers sub-frontiers beyond the original researcher's work.

**Input:** Frontier ID + depth limit

**Pipeline:**
1. Read the frontier's key papers from `ResearchGraphService`
2. For each key paper, fetch references and citations via `SemanticScholarService` (papers *outside* the original researcher's work)
3. Collect expanded paper set (deduplicated)
4. Send to LLM: *"Given this frontier [label + summary] and these adjacent papers, identify 2–4 sub-frontiers representing where this field is heading"*
5. LLM returns structured sub-frontiers
6. Write sub-frontier nodes + edges to `ResearchGraphService`
7. Broadcast `frontiers_discovered` with `parentId` (for incremental graph update)
8. If depth > 1, recursively invoke self for each sub-frontier with depth − 1

**Concurrency:** Paper citation/reference fetches run in parallel (bounded: 5). Recursive sub-frontier expansions run with concurrency limit of 3.

### PaperCollector

Gathers detailed paper info for the Elaborate view.

**Input:** Frontier ID

**Pipeline:**
1. Read the frontier's key paper IDs from `ResearchGraphService`
2. Batch-fetch full paper details via `SemanticScholarService` (title, abstract, authors, citationCount, TLDR, year)
3. Extract unique authors as "contributors"
4. Write paper + contributor nodes to `ResearchGraphService` (as children of the frontier Combo)
5. Broadcast `papers_collected`

**Concurrency:** Single batch request (Semantic Scholar batch API supports up to 500 papers).

### Synthesizer

LLM-powered summarization utility. Not dispatched directly by the Orchestrator — called internally by FrontierDiscovery and FrontierExpander.

**Input:** List of papers + context prompt

**Pipeline:**
1. Build prompt with paper titles/abstracts
2. Call LLM via `LlmService`
3. Parse structured JSON response

**Output:** Structured frontier descriptions.

### Orchestration Flows

#### Flow 1: Initial Search

```
User types "Geoffrey Hinton"
  → REST POST /api/explore { name: "Geoffrey Hinton" }
    → Orchestrator.startExploration(name)
      → SemanticScholarService.searchAuthor(name) → researcher object
      → broadcast "researcher_found" (researcher node appears on graph)
      → Fork Fiber: FrontierDiscovery.discover(researcherId)
        → fetch papers
        → LLM clusters into frontiers
        → broadcast "frontiers_discovered" (frontier nodes stream in)
      → broadcast "exploration_complete"
```

#### Flow 2: Expand

```
User clicks Expand on a frontier
  → WS message: { type: "expand", frontierId }
    → Orchestrator.expand(frontierId, depth=1)
      → Fork Fiber: FrontierExpander.expand(frontierId, depth=1)
        → fetch citations/references for key papers (5 concurrent)
        → LLM identifies sub-frontiers
        → broadcast "frontiers_discovered" (incremental, per sub-frontier)
      → broadcast "expansion_complete"
```

#### Flow 3: Elaborate

```
User clicks Elaborate on a frontier
  → WS message: { type: "elaborate", frontierId }
    → Orchestrator.elaborate(frontierId)
      → Fork Fiber: PaperCollector.collect(frontierId)
        → batch-fetch paper details
        → extract contributors
        → broadcast "papers_collected" (papers appear inside frontier Combo)
```

#### Cancellation

```
User clicks Stop
  → WS message: { type: "stop" }
    → Orchestrator interrupts all active Fibers for this session
      → Effect Fiber interruption propagates to all child fibers
      → In-flight HTTP requests to APIs are cancelled
      → broadcast "exploration_cancelled"
```

### Communication Model

- Agents do **not** communicate with each other directly
- All state flows through services: agents read from and write to `ResearchGraphService`
- All client communication flows through `WebSocketHubService.broadcast()`
- The Orchestrator coordinates by forking agents as Fibers and optionally joining/interrupting them

---

## Effect.ts Patterns

### Services as Context Tags

Every service is a `Context.Tag` with a `Layer` providing its implementation. This gives us compile-time dependency tracking and testability via layer swapping.

```typescript
// Definition
class SemanticScholarService extends Context.Tag("SemanticScholarService")<
  SemanticScholarService,
  {
    searchAuthor: (name: string) => Effect.Effect<Researcher, ApiError>
    getAuthorPapers: (id: string) => Effect.Effect<Paper[], ApiError>
    batchGetPapers: (ids: string[]) => Effect.Effect<Paper[], ApiError>
    getCitations: (paperId: string) => Effect.Effect<Paper[], ApiError>
    getReferences: (paperId: string) => Effect.Effect<Paper[], ApiError>
  }
>() {}

// Usage in an agent — dependency is tracked in the type
const discover = (researcherId: string) =>
  Effect.gen(function* () {
    const s2 = yield* SemanticScholarService
    const llm = yield* LlmService
    const graph = yield* ResearchGraphService
    const hub = yield* WebSocketHubService

    const papers = yield* s2.getAuthorPapers(researcherId)
    const topPapers = papers.sort(byCitations).slice(0, 30)
    const frontiers = yield* llm.clusterIntoFrontiers(topPapers)
    yield* graph.addFrontiers(researcherId, frontiers)
    yield* hub.broadcast(sessionId, { type: "frontiers_discovered", frontiers })

    return frontiers
  })
```

### Agent Lifecycle

Agents are pure Effect functions — no classes, no internal state. All state lives in services. This makes them composable and testable.

### Error Handling

```
Tagged Errors (ApiError, LlmError, ParseError)
  → Retry with exponential backoff (API rate limits)
    → Fallback: OpenAlex when Semantic Scholar fails
      → Final: broadcast error event to client
```

Errors are modeled as tagged unions using `Data.TaggedError`. Rate limit errors from Semantic Scholar trigger automatic retry with exponential backoff. If retries are exhausted, the system falls back to OpenAlex for the same query. Unrecoverable errors are broadcast to the client as error events.

### Fiber Concurrency & Cancellation

```typescript
// Orchestrator forks agents as Fibers
const fiber = yield* Effect.fork(
  FrontierDiscovery.discover(researcherId)
)
activeFibers.set(sessionId, fiber)

// Cancellation — interrupts propagate to all children
yield* Fiber.interrupt(fiber)
```

Effect's structured concurrency means interrupting a parent Fiber automatically interrupts all child Fibers, including in-flight HTTP requests.

### Layer Composition

```typescript
// main.ts — compose all services into the application Layer
const MainLayer = Layer.mergeAll(
  SemanticScholarServiceLive,
  OpenAlexServiceLive,
  LlmServiceLive,
  ResearchGraphServiceLive,
  WebSocketHubServiceLive,
).pipe(
  Layer.provideMerge(HttpClientLive),
  Layer.provideMerge(ConfigLive),
)

// Run the server with all dependencies provided
pipe(
  HttpApi.serve(routes),
  Layer.provide(MainLayer),
  Layer.launch,
)
```

---

## Data Flow

### 1. Initial Search: Name → Frontiers

```
[Browser]                    [Server]                    [External]
    │                            │                            │
    ├─ POST /api/explore ───────►│                            │
    │  { name: "Hinton" }        │                            │
    │                            ├─ searchAuthor("Hinton") ──►│ S2 API
    │                            │◄─ { id, name, papers } ────┤
    │◄─ { sessionId } ──────────┤                            │
    │                            │                            │
    ├─ WS connect ──────────────►│                            │
    │                            │                            │
    │◄─ researcher_found ────────┤                            │
    │   (researcher node)        │                            │
    │                            ├─ getAuthorPapers(id) ─────►│ S2 API
    │                            │◄─ [paper, paper, ...] ─────┤
    │                            │                            │
    │                            ├─ clusterFrontiers(papers) ►│ Claude
    │                            │◄─ [frontier, frontier] ────┤  Haiku
    │                            │                            │
    │◄─ frontiers_discovered ────┤                            │
    │   (frontier nodes + edges) │                            │
    │                            │                            │
    │◄─ exploration_complete ────┤                            │
```

### 2. Expand: Frontier → Sub-Frontiers

```
[Browser]                    [Server]                    [External]
    │                            │                            │
    ├─ WS { expand, id } ──────►│                            │
    │                            │                            │
    │                            ├─ getCitations(paper1) ────►│ S2 API
    │                            ├─ getCitations(paper2) ────►│ (5 max
    │                            ├─ getReferences(paper1) ───►│  concurrent)
    │                            │◄─ [papers...] ─────────────┤
    │                            │                            │
    │                            ├─ identifySubFrontiers() ──►│ Claude
    │                            │◄─ [sub-frontier, ...] ─────┤  Haiku
    │                            │                            │
    │◄─ frontiers_discovered ────┤                            │
    │   (sub-frontier nodes,     │                            │
    │    parentId = frontier)     │                            │
```

### 3. Elaborate: Frontier → Papers + Contributors

```
[Browser]                    [Server]                    [External]
    │                            │                            │
    ├─ WS { elaborate, id } ───►│                            │
    │                            │                            │
    │                            ├─ batchGetPapers(ids) ─────►│ S2 API
    │                            │◄─ [full paper details] ────┤
    │                            │                            │
    │◄─ papers_collected ────────┤                            │
    │   (paper + contributor     │                            │
    │    nodes inside Combo)     │                            │
```

---

## Shared Schemas

Defined in `packages/shared` using Effect Schema. Shared between frontend and backend.

### Domain Types

```typescript
// Researcher
Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  affiliations: Schema.Array(Schema.String),
  paperCount: Schema.Number,
  citationCount: Schema.Number,
  hIndex: Schema.Number,
})

// Paper
Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  abstract: Schema.optionalWith(Schema.String, { as: "Option" }),
  year: Schema.Number,
  citationCount: Schema.Number,
  authors: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })),
  fieldsOfStudy: Schema.Array(Schema.String),
  tldr: Schema.optionalWith(Schema.String, { as: "Option" }),
})

// Frontier
Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  summary: Schema.String,
  paperIds: Schema.Array(Schema.String),
  parentId: Schema.optionalWith(Schema.String, { as: "Option" }),
})
```

### Graph Types

```typescript
// GraphNode
Schema.Union(
  Schema.Struct({ type: Schema.Literal("researcher"), data: Researcher }),
  Schema.Struct({ type: Schema.Literal("frontier"), data: Frontier }),
  Schema.Struct({ type: Schema.Literal("paper"), data: Paper }),
  Schema.Struct({ type: Schema.Literal("contributor"), data: Schema.Struct({ id: Schema.String, name: Schema.String }) }),
)

// GraphEdge
Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  type: Schema.Literal("has_frontier", "has_subfrontier", "has_paper", "has_contributor"),
})
```

### WebSocket Events

```typescript
// Client → Server
Schema.Union(
  Schema.Struct({ type: Schema.Literal("expand"), frontierId: Schema.String }),
  Schema.Struct({ type: Schema.Literal("elaborate"), frontierId: Schema.String }),
  Schema.Struct({ type: Schema.Literal("stop") }),
)

// Server → Client
Schema.Union(
  Schema.Struct({ type: Schema.Literal("researcher_found"), node: GraphNode }),
  Schema.Struct({ type: Schema.Literal("frontiers_discovered"), nodes: Schema.Array(GraphNode), edges: Schema.Array(GraphEdge), parentId: Schema.optionalWith(Schema.String, { as: "Option" }) }),
  Schema.Struct({ type: Schema.Literal("papers_collected"), nodes: Schema.Array(GraphNode), edges: Schema.Array(GraphEdge), frontierId: Schema.String }),
  Schema.Struct({ type: Schema.Literal("exploration_complete"), explorationId: Schema.String }),
  Schema.Struct({ type: Schema.Literal("exploration_cancelled") }),
  Schema.Struct({ type: Schema.Literal("error"), message: Schema.String }),
)
```

---

## Technology Summary

| Concern | Choice | Justification |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Shared schemas between frontend/backend; fast parallel builds |
| Frontend framework | React 19 | Ecosystem, G6 React extension support |
| Bundler | Vite 6 | Fast HMR, optimized builds, zero-config for React |
| Graph visualization | @antv/g6 v5 + g6-extension-react | Combo grouping, collapse/expand, React node rendering, incremental updates |
| State management | Zustand | Minimal boilerplate, no providers, external system integration |
| Runtime | Bun | Native TS, fast startup, built-in WebSocket server |
| Server framework | @effect/platform HttpApi | Native Effect integration, no Express/Fastify needed |
| Effect system | Effect.ts | Typed services, structured concurrency, fiber cancellation, error handling |
| LLM | Anthropic Claude Haiku | Fast, cheap, good at structured JSON output |
| Academic data (primary) | Semantic Scholar API | Free, rich metadata, citation graphs, batch API |
| Academic data (fallback) | OpenAlex | Free, no auth required, good coverage |
| Real-time | WebSocket | Bidirectional, incremental graph updates as agents discover results |

---

## Academic Data Sources

### Semantic Scholar (Primary)

Base URL: `https://api.semanticscholar.org/graph/v1`

| Endpoint | Use |
|---|---|
| `GET /author/search?query={name}` | Find researcher by name |
| `GET /author/{id}/papers` | Get researcher's publications |
| `GET /paper/{id}` | Paper details (title, abstract, TLDR, authors) |
| `GET /paper/{id}/citations` | Papers that cite this paper |
| `GET /paper/{id}/references` | Papers this paper references |
| `POST /paper/batch` | Batch fetch up to 500 papers by ID |

**Rate limits:** 1 request/second without API key, 10 requests/second with key. The system uses exponential backoff on 429 responses.

### OpenAlex (Fallback)

Base URL: `https://api.openalex.org`

| Endpoint | Use |
|---|---|
| `GET /authors?search={name}` | Find researcher by name |
| `GET /works?filter=author.id:{id}` | Get researcher's publications |
| `GET /works/{id}` | Paper details |

**Rate limits:** 10 requests/second with polite pool (email in `mailto` param). No API key required.

### Fallback Strategy

```
SemanticScholar request
  → 429 Too Many Requests? → exponential backoff (3 retries, 1s/2s/4s)
    → still failing? → OpenAlex for the same query
      → OpenAlex also failing? → broadcast error to client
```

OpenAlex IDs differ from Semantic Scholar IDs, so the `OpenAlexService` maps results to the shared `Paper` schema with a source tag for deduplication.
