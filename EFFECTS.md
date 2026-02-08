# Effects

## Runtime

| Aspect      | Detail                                                                 |
|-------------|------------------------------------------------------------------------|
| Language    | TypeScript (strict)                                                    |
| Library     | Effect TS v3 (`effect 3.19`, `@effect/platform`, `@effect/platform-bun`) |
| Runtime     | Bun                                                                    |
| Entry point | `ManagedRuntime.make(ServiceLayer)` → `appRuntime` in `apps/server/src/main.ts` |
| Frontend    | Effect for schema decoding and API calls (`Effect.runSync` in React hooks) |

`ServiceLayer` is built with `Layer.mergeAll` over all service layers, providing a single composition root that is constructed once at startup.

## I/O Boundary

Every side-effect the system performs on the outside world:

| Effect               | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| **Network / HTTP**   | OpenAlex API, Semantic Scholar API, Anthropic Claude API                    |
| **WebSocket I/O**    | Bidirectional real-time messages to browser clients                         |
| **Persistence**      | In-memory session state (`ResearchGraphService`)                            |
| **Concurrency**      | Fiber forking, tracking, and interruption per session                       |
| **Configuration**    | Environment variables (`ANTHROPIC_API_KEY`, `OPENALEX_API_KEY`, `S2_API_KEY`) via `Config` |
| **Scheduling**       | Exponential backoff with rate-limit awareness (`Schedule`)                  |
| **Serialization**    | Schema-based encode/decode at every I/O boundary (`Schema`)                 |

## Effect Definitions

### Services (`Context.Tag` + `Layer`)

All in `apps/server/src/services/`:

| Service                   | File                          | Purpose                             |
|---------------------------|-------------------------------|-------------------------------------|
| `LlmService`             | `LlmService.ts`              | Anthropic Claude inference          |
| `OpenAlexService`        | `OpenAlexService.ts`         | OpenAlex academic data API          |
| `SemanticScholarService` | `SemanticScholarService.ts`  | Semantic Scholar academic data API  |
| `ResearchGraphService`   | `ResearchGraphService.ts`    | In-memory session graph state       |
| `WebSocketHubService`    | `WebSocketHubService.ts`     | WebSocket connection management     |

### Errors (`Data.TaggedError`)

| Error         | Location                        |
|---------------|---------------------------------|
| `ApiError`    | `apps/server/src/errors.ts`     |
| `LlmError`   | `apps/server/src/errors.ts`     |
| `ParseError`  | `apps/server/src/errors.ts`     |
| `ApiError`    | `apps/web/src/lib/errors.ts`    |
| `DecodeError` | `apps/web/src/lib/errors.ts`    |

### Schemas

All in `packages/shared/src/schemas/`:

| File              | Schemas                                                   |
|-------------------|-----------------------------------------------------------|
| `researcher.ts`   | `Researcher`                                              |
| `graph.ts`        | `Paper`, `Frontier`, `GraphNode`, `GraphEdge`             |
| `ws.ts`           | `ClientMessage`, `ServerMessage`                          |

### Composition & Fiber Management

| Symbol            | Location                                    | Role                                      |
|-------------------|---------------------------------------------|-------------------------------------------|
| `ServiceLayer`    | `apps/server/src/main.ts`                   | `Layer.mergeAll` of all service layers     |
| `appRuntime`      | `apps/server/src/main.ts`                   | `ManagedRuntime.make(ServiceLayer)`        |
| `trackFiber`      | `apps/server/src/agents/Orchestrator.ts`    | Registers a fiber against a session ID     |
| `cancelSession`   | `apps/server/src/agents/Orchestrator.ts`    | Interrupts all fibers for a session        |

## Pure Core

All agents live in `apps/server/src/agents/` and are pure `Effect.gen` generator functions that yield services from context — none perform direct I/O.

| Agent                | File                      | Responsibility                                                  |
|----------------------|---------------------------|-----------------------------------------------------------------|
| **FrontierDiscovery** | `FrontierDiscovery.ts`   | Fetches a researcher's papers, clusters them into frontiers via LLM |
| **FrontierExpander**  | `FrontierExpander.ts`    | Fetches citations/references, identifies sub-frontiers recursively |
| **PaperCollector**    | `PaperCollector.ts`      | Batch-fetches paper metadata, extracts contributors              |
| **Synthesizer**       | `Synthesizer.ts`         | Pure prompt construction + schema validation for LLM clustering  |
| **Orchestrator**      | `Orchestrator.ts`        | Coordinates agents as forked fibers, manages session lifecycle   |

### Data Flow

```
researcher name
  → papers (OpenAlex / Semantic Scholar)
    → LLM clustering (Synthesizer)
      → frontiers
        → expansion (citations/references)
          → sub-frontiers
            → elaboration (papers + contributors)
```

Each step is an effectful computation that declares its dependencies via the service context and its failure modes via typed errors — the runtime provides the real implementations at the edge.
