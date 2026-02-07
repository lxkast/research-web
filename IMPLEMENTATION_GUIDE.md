# Implementation Guide: Research Intelligence Engine

A stage-by-stage guide where each stage produces a verifiable, observable output. Complete stages in order unless noted as parallelizable.

---

## Stage 1: Monorepo Scaffold

**Goal:** pnpm workspaces + Turborepo + shared types compile cleanly.

### Steps

1. **Initialize the workspace root**
   - Create `package.json` with `"private": true` and `"packageManager": "pnpm@9"`
   - Create `pnpm-workspace.yaml`:
     ```yaml
     packages:
       - "packages/*"
       - "apps/*"
     ```
   - Create `turbo.json`:
     ```json
     {
       "$schema": "https://turbo.build/schema.json",
       "tasks": {
         "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
         "dev": { "cache": false, "persistent": true },
         "typecheck": { "dependsOn": ["^build"] }
       }
     }
     ```

2. **Create `tsconfig.base.json`**
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true,
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "verbatimModuleSyntax": true,
       "composite": true
     }
   }
   ```

3. **Create `packages/shared`**
   - `packages/shared/package.json`:
     ```json
     {
       "name": "@research-web/shared",
       "version": "0.0.1",
       "type": "module",
       "main": "./dist/index.js",
       "types": "./dist/index.d.ts",
       "scripts": {
         "build": "tsc -b",
         "typecheck": "tsc --noEmit"
       },
       "dependencies": {
         "effect": "^3",
         "@effect/schema": "^0.75"
       },
       "devDependencies": {
         "typescript": "^5.6"
       }
     }
     ```
   - `packages/shared/tsconfig.json` extending `tsconfig.base.json` with `outDir: "./dist"`, `rootDir: "./src"`
   - `packages/shared/src/schemas/researcher.ts` — Effect Schema definitions for `Researcher`, `Paper`, `Frontier`
   - `packages/shared/src/schemas/graph.ts` — `GraphNode` (discriminated union: researcher | frontier | paper | contributor), `GraphEdge`
   - `packages/shared/src/schemas/ws.ts` — `ClientMessage` (expand | elaborate | stop), `ServerMessage` (researcher_found | frontiers_discovered | papers_collected | exploration_complete | exploration_cancelled | error)
   - `packages/shared/src/index.ts` — re-exports all schemas and inferred types

   > **Note on `@effect/schema`:** As of Effect 3.x, Schema is part of the `effect` package itself (`import { Schema } from "effect"`). Check the version at install time — if using Effect 3.12+, you may not need `@effect/schema` as a separate dependency.

4. **Create `apps/server` stub**
   - `apps/server/package.json` with `"name": "@research-web/server"`, dependency on `@research-web/shared`
   - `apps/server/tsconfig.json` extending base, `"types": ["bun-types"]`
   - `apps/server/src/main.ts` — minimal `console.log("server placeholder")`
   - Build script: `"build": "tsc -b"`

5. **Create `apps/web` stub**
   - `apps/web/package.json` with `"name": "@research-web/web"`, dependency on `@research-web/shared`
   - `apps/web/tsconfig.json` extending base with `"jsx": "react-jsx"`
   - `apps/web/src/main.tsx` — `console.log("web placeholder")`
   - Build script: `"build": "tsc -b"`

6. **Install and build**
   ```bash
   pnpm install
   pnpm turbo build
   ```

### Verify

```bash
pnpm install && pnpm turbo build
```

**Expected:** All three packages (`shared`, `server`, `web`) compile with zero errors. Turborepo shows a successful pipeline run with three tasks.

---

## Stage 2: Effect.ts Server + Health Endpoint

**Goal:** A running Bun server with `GET /api/health` using Effect.ts service patterns.

### Steps

1. **Add server dependencies** to `apps/server/package.json`:
   ```
   effect, @effect/platform, @effect/platform-bun
   ```
   Dev dependency: `bun-types`

2. **Define tagged error types** in `apps/server/src/errors.ts`:
   ```typescript
   import { Data } from "effect"

   export class ApiError extends Data.TaggedError("ApiError")<{
     message: string
     status?: number
   }> {}

   export class LlmError extends Data.TaggedError("LlmError")<{
     message: string
   }> {}

   export class ParseError extends Data.TaggedError("ParseError")<{
     message: string
     raw: unknown
   }> {}
   ```

3. **Define service `Context.Tag` stubs** in `apps/server/src/services/`:
   - `SemanticScholarService.ts` — Tag with interface (all 5 methods returning `Effect<_, ApiError>`)
   - `OpenAlexService.ts` — Tag with interface (stub)
   - `LlmService.ts` — Tag with interface (stub)
   - `ResearchGraphService.ts` — Tag with interface (stub)
   - `WebSocketHubService.ts` — Tag with interface (stub)

   Each file exports the Tag and a `*Stub` Layer that returns `Effect.die("not implemented")` for every method. This establishes the Layer composition pattern without real implementations.

4. **Define HTTP routes** in `apps/server/src/api/routes.ts`:
   ```typescript
   import { HttpApiEndpoint, HttpApiGroup, HttpApi } from "@effect/platform"
   import { Effect } from "effect"

   const healthEndpoint = HttpApiEndpoint.get("health", "/api/health").pipe(
     HttpApiEndpoint.setSuccess(/* Schema for { status: string } */)
   )

   const apiGroup = HttpApiGroup.make("api").pipe(
     HttpApiGroup.add(healthEndpoint)
   )

   export const Api = HttpApi.make("research-web").pipe(
     HttpApi.addGroup(apiGroup)
   )
   ```

5. **Wire up `main.ts`** — compose all stub Layers, create the Bun HTTP server:
   ```typescript
   import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
   import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
   import { Layer } from "effect"

   // Implement the health handler
   const ApiLive = HttpApiBuilder.group(Api, "api", (handlers) =>
     handlers.handle("health", () => Effect.succeed({ status: "ok" }))
   )

   // Compose layers
   const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
     Layer.provide(ApiLive),
     Layer.provide(HttpApiBuilder.api(Api)),
     Layer.provide(BunHttpServer.layer({ port: 3001 })),
   )

   // Launch
   Layer.launch(ServerLive).pipe(BunRuntime.runMain)
   ```

   > **Note:** The exact `@effect/platform` API surface for `HttpApi` changes across versions. Consult the docs for your installed version. The pattern is: define endpoints → group them → implement handlers → serve with a Layer. If the API differs, adjust accordingly — the key principle is that routes are Effect programs composed via Layers.

6. **Update `apps/server/package.json` scripts:**
   ```json
   {
     "dev": "bun run --watch src/main.ts",
     "start": "bun run src/main.ts"
   }
   ```

### Verify

```bash
cd apps/server && bun run src/main.ts &
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
kill %1
```

---

## Stage 3: Semantic Scholar Service (Standalone)

**Goal:** A working `SemanticScholarService` that fetches real data from the Semantic Scholar API.

> **Parallelism:** Stage 3 and Stage 4 can run in parallel (backend vs frontend, independently verifiable).

### Steps

1. **Implement `SemanticScholarService`** in `apps/server/src/services/SemanticScholarService.ts`:
   - Use `HttpClient` from `@effect/platform` for requests
   - Base URL: `https://api.semanticscholar.org/graph/v1`
   - Optional API key via `Config.string("S2_API_KEY").pipe(Config.withDefault(""))`
   - All 5 endpoints:

   | Method | S2 Endpoint | Key fields to request |
   |---|---|---|
   | `searchAuthor(name)` | `GET /author/search?query={name}` | `authorId,name,affiliations,paperCount,citationCount,hIndex` |
   | `getAuthorPapers(id)` | `GET /author/{id}/papers` | `paperId,title,abstract,year,citationCount,authors,fieldsOfStudy,tldr` |
   | `batchGetPapers(ids)` | `POST /paper/batch` | Same as above |
   | `getCitations(paperId)` | `GET /paper/{id}/citations` | `paperId,title,abstract,year,citationCount,authors` |
   | `getReferences(paperId)` | `GET /paper/{id}/references` | `paperId,title,abstract,year,citationCount,authors` |

   - Parse responses through Effect Schema (the `Researcher` and `Paper` schemas from `@research-web/shared`)
   - On HTTP 429: retry with exponential backoff (3 retries, delays: 1s → 2s → 4s) using `Effect.retry` with `Schedule.exponential`
   - Map non-429 HTTP errors to `ApiError`

2. **Create `OpenAlexService` stub Layer** — same interface shape, all methods return `Effect.fail(new ApiError({ message: "OpenAlex not implemented" }))`. This is wired up for real in Stage 9.

3. **Create the test script** `scripts/test-s2.ts`:
   ```typescript
   import { Effect, Layer } from "effect"
   import { SemanticScholarService, SemanticScholarServiceLive } from "../apps/server/src/services/SemanticScholarService"
   import { BunHttpClient } from "@effect/platform-bun"

   const program = Effect.gen(function* () {
     const s2 = yield* SemanticScholarService

     const researcher = yield* s2.searchAuthor("Geoffrey Hinton")
     console.log(`Researcher: ${researcher.name}`)
     console.log(`Papers: ${researcher.paperCount}`)

     const papers = yield* s2.getAuthorPapers(researcher.id)
     const top = papers.sort((a, b) => b.citationCount - a.citationCount)[0]
     console.log(`Top paper: ${top.title} (${top.citationCount} citations)`)
   })

   program.pipe(
     Effect.provide(SemanticScholarServiceLive),
     Effect.provide(BunHttpClient.layer),
     BunRuntime.runMain,
   )
   ```

4. **Add a convenience script** in root `package.json`:
   ```json
   { "scripts": { "test:s2": "bun run scripts/test-s2.ts" } }
   ```

### Verify

```bash
bun run scripts/test-s2.ts
```

**Expected output** (approximately):
```
Researcher: Geoffrey E. Hinton
Papers: 387
Top paper: Deep Learning (48231 citations)
```

### Risks

- **Rate limits:** Without an API key, S2 allows 1 request/second. The test script makes 2 sequential requests so it should be fine. Set `S2_API_KEY` env var for faster iteration during later stages.
- **API response shape changes:** S2 occasionally adds/removes fields. The Effect Schema parse will catch mismatches — fix the schema if this happens.

---

## Stage 4: Frontend Shell + Graph (Mock Data)

**Goal:** A React SPA with an interactive G6 graph showing mock data with React-rendered nodes.

> **Parallelism:** Stage 3 and Stage 4 can run in parallel.

### Steps

1. **Set up Vite + React** in `apps/web`:
   - `pnpm add react react-dom` + `pnpm add -D @types/react @types/react-dom vite @vitejs/plugin-react`
   - `vite.config.ts`:
     ```typescript
     import { defineConfig } from "vite"
     import react from "@vitejs/plugin-react"
     export default defineConfig({
       plugins: [react()],
       server: { port: 5173, proxy: { "/api": "http://localhost:3001", "/ws": { target: "ws://localhost:3001", ws: true } } },
     })
     ```
   - `index.html` with `<div id="root">` and `<script type="module" src="/src/main.tsx">`
   - Update `apps/web/package.json` scripts: `"dev": "vite", "build": "vite build"`

2. **Install graph dependencies:**
   ```bash
   pnpm add @antv/g6 @antv/g6-extension-react
   ```

3. **Create the Zustand store** in `apps/web/src/store/index.ts`:
   ```typescript
   import { create } from "zustand"
   import type { GraphNode, GraphEdge } from "@research-web/shared"

   interface GraphStore {
     nodes: GraphNode[]
     edges: GraphEdge[]
     wsStatus: "connecting" | "connected" | "disconnected"
     activeExplorations: Set<string>
     selectedNode: string | null
     addNodes: (nodes: GraphNode[]) => void
     addEdges: (edges: GraphEdge[]) => void
     setWsStatus: (status: GraphStore["wsStatus"]) => void
     setExplorationActive: (id: string) => void
     setExplorationComplete: (id: string) => void
     reset: () => void
   }

   export const useGraphStore = create<GraphStore>((set) => ({
     nodes: [],
     edges: [],
     wsStatus: "disconnected",
     activeExplorations: new Set(),
     selectedNode: null,
     addNodes: (nodes) => set((s) => ({ nodes: [...s.nodes, ...nodes] })),
     addEdges: (edges) => set((s) => ({ edges: [...s.edges, ...edges] })),
     setWsStatus: (wsStatus) => set({ wsStatus }),
     setExplorationActive: (id) =>
       set((s) => ({ activeExplorations: new Set([...s.activeExplorations, id]) })),
     setExplorationComplete: (id) =>
       set((s) => {
         const next = new Set(s.activeExplorations)
         next.delete(id)
         return { activeExplorations: next }
       }),
     reset: () => set({ nodes: [], edges: [], activeExplorations: new Set(), selectedNode: null }),
   }))
   ```

4. **Initialize with mock data** (temporary — removed in Stage 6):
   - In `App.tsx` or a `useMockData` hook, populate the store on mount with:
     - 1 researcher node (center): `{ type: "researcher", data: { id: "hinton", name: "Geoffrey Hinton", ... } }`
     - 4 frontier nodes: `{ type: "frontier", data: { id: "f1", label: "Deep Learning Foundations", ... } }`, etc.
     - 4 edges from researcher → each frontier

5. **Create React node components** in `apps/web/src/components/nodes/`:
   - `ResearcherNode.tsx` — displays name, paper count, h-index. Styled with a distinct background (e.g., blue).
   - `FrontierNode.tsx` — displays label, summary snippet. Styled differently (e.g., green). Includes placeholder Expand/Elaborate buttons (not wired yet).

6. **Create `GraphCanvas.tsx`**:
   - Register the React extension: `import { ExtensionCategory, register } from "@antv/g6"` + `import { ReactNode } from "@antv/g6-extension-react"`
   - Register `ReactNode` with `register(ExtensionCategory.NODE, "react", ReactNode)`
   - Initialize G6 `Graph` instance in a `useEffect`:
     ```typescript
     const graph = new Graph({
       container: containerRef.current,
       data: { nodes: [...], edges: [...] },
       node: {
         type: "react",
         style: {
           component: (data) => {
             // Return ResearcherNode or FrontierNode based on data.type
           },
           size: [200, 80],
         },
       },
       layout: { type: "d3-force", preventOverlap: true },
       behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
     })
     ```
   - Size the container to fill the viewport

7. **Create `useGraph` hook** in `apps/web/src/hooks/useGraph.ts`:
   - Subscribes to the Zustand store
   - On store changes, maps `GraphNode[]` / `GraphEdge[]` to G6's data format and calls `graph.addData()` or `graph.setData()` to sync
   - Handles the translation between shared schema types and G6's expected node/edge config

8. **Create `SearchBar.tsx`** — text input + submit button. On submit, logs `console.log("Search:", query)`. Not wired to the backend yet.

9. **Create `App.tsx`** — renders `<SearchBar />` and `<GraphCanvas />` in a simple layout (search bar at top, graph fills remaining space).

### Verify

```bash
cd apps/web && pnpm dev
# Open http://localhost:5173
```

**Expected:** Browser shows a graph with 5 styled nodes (1 blue researcher + 4 green frontiers) connected by edges. The graph is pannable (drag canvas), zoomable (scroll wheel), and nodes are draggable. Typing in the search bar and pressing Enter logs to the console.

### Risks

- **`@antv/g6-extension-react` compatibility:** This extension is relatively new. If it doesn't work with your G6 version, check the npm page for compatible versions. Worst case: fall back to G6's built-in custom node rendering (canvas-based) and revisit React nodes later.
- **Layout jittering:** The force layout may take a moment to stabilize. If nodes jump around too much, try `d3-force` with `forceSimulation: { alphaDecay: 0.05 }` or switch to `"type": "force"` with G6's built-in force layout.

---

## Stage 5: WebSocket Connection (Bidirectional)

**Goal:** Browser ↔ server WebSocket communication with connection status tracking.

### Steps

1. **Add WebSocket support to the Bun server** in `apps/server/src/main.ts`:
   - Bun.serve supports WebSocket natively alongside HTTP. Adjust the server setup to use `Bun.serve` directly (rather than pure `@effect/platform` serve) so that both HTTP and WS coexist:
     ```typescript
     Bun.serve({
       port: 3001,
       fetch(req, server) {
         const url = new URL(req.url)
         if (url.pathname === "/ws") {
           server.upgrade(req)
           return // WebSocket upgrade
         }
         // Delegate to Effect HttpApi handler for HTTP routes
         return effectHandler(req)
       },
       websocket: {
         open(ws) { /* register in WebSocketHub */ },
         message(ws, msg) { /* parse ClientMessage, echo back for now */ },
         close(ws) { /* unregister */ },
       },
     })
     ```

   > **Note on Effect + Bun.serve coexistence:** You need to bridge between `@effect/platform`'s HTTP handling and Bun's native `fetch` handler. One approach: build the Effect HTTP app as a handler function, then call it from Bun.serve's `fetch`. See `@effect/platform-bun` docs for `BunHttpServer.layerContext` or similar utilities. If this proves awkward, an alternative is to use Effect only for the service layer and handle HTTP routing with Bun.serve directly.

2. **Implement `WebSocketHubService`** (real implementation):
   ```typescript
   // In-memory map: sessionId → Set<ServerWebSocket>
   // Methods:
   //   register(sessionId, ws) → void
   //   unregister(ws) → void
   //   broadcast(sessionId, message: ServerMessage) → Effect<void>
   //   broadcastAll(message: ServerMessage) → Effect<void>
   ```
   Create the Live Layer using `Effect.Tag` + `Layer.succeed` or `Layer.effect` with a `Ref` for mutable state.

3. **Add echo behavior** to the WebSocket message handler:
   - Parse incoming message as `ClientMessage` using the shared schema
   - For now, echo it back as a `ServerMessage` of type `error` with `message: "echo: <original>"` (temporary — replaced in Stage 6)
   - Log parsed messages to console

4. **Create `useWebSocket` hook** in `apps/web/src/hooks/useWebSocket.ts`:
   ```typescript
   export function useWebSocket(url: string) {
     const setWsStatus = useGraphStore((s) => s.setWsStatus)
     const addNodes = useGraphStore((s) => s.addNodes)
     const addEdges = useGraphStore((s) => s.addEdges)

     useEffect(() => {
       const ws = new WebSocket(url)
       ws.onopen = () => setWsStatus("connected")
       ws.onclose = () => setWsStatus("disconnected")
       ws.onmessage = (event) => {
         const msg = JSON.parse(event.data) as ServerMessage
         switch (msg.type) {
           case "researcher_found": addNodes([msg.node]); break
           case "frontiers_discovered": addNodes(msg.nodes); addEdges(msg.edges); break
           case "papers_collected": addNodes(msg.nodes); addEdges(msg.edges); break
           case "exploration_complete": /* setExplorationComplete */ break
           case "error": console.error("Server error:", msg.message); break
         }
       }
       return () => ws.close()
     }, [url])
   }
   ```

5. **Add `wsStatus` display** in `App.tsx` — a small indicator showing "connected" / "disconnected" (e.g., a colored dot + text in the corner).

6. **Wire up in `App.tsx`:**
   ```typescript
   useWebSocket("ws://localhost:3001/ws")
   ```

### Verify

**Test 1 — Browser:**
```bash
# Terminal 1: start server
cd apps/server && bun run src/main.ts
# Terminal 2: start frontend
cd apps/web && pnpm dev
# Open http://localhost:5173 — should show "connected" status indicator
```

**Test 2 — wscat:**
```bash
npx wscat -c ws://localhost:3001/ws
> {"type":"expand","frontierId":"test-123"}
# Expected: server echoes back the message
```

### Risks

- **Effect + Bun WS coexistence:** This is the key integration risk. If `@effect/platform-bun`'s server doesn't expose WebSocket upgrade hooks, you'll need to use `Bun.serve` directly and bridge Effect's HTTP handling manually. Stage 5 exists to prove this works before building on it.

---

## Stage 6: Search Flow (End-to-End)

**Goal:** Type a researcher name → see researcher node and frontier nodes stream into the graph.

### Steps

1. **Implement `LlmService`** in `apps/server/src/services/LlmService.ts`:
   - Uses `@anthropic-ai/sdk` (install it)
   - Config: `ANTHROPIC_API_KEY` env var, model `claude-haiku-4-5-20251001`
   - Single method: `complete(systemPrompt: string, userPrompt: string) => Effect<string, LlmError>`
   - Wraps the Anthropic SDK call in `Effect.tryPromise`, maps errors to `LlmError`

2. **Implement `ResearchGraphService`** in `apps/server/src/services/ResearchGraphService.ts`:
   - In-memory graph state per session, stored in a `Map<sessionId, { nodes, edges }>`
   - Methods:
     ```
     getOrCreateSession(sessionId) → Session
     addResearcher(sessionId, researcher) → Effect<void>
     addFrontiers(sessionId, researcherId, frontiers) → Effect<void>
     getFrontier(sessionId, frontierId) → Effect<Frontier>
     addPapers(sessionId, frontierId, papers) → Effect<void>
     ```
   - Use `Effect.sync` wrapping `Map` mutations, or a `Ref` for safer concurrent access

3. **Implement `Synthesizer`** in `apps/server/src/agents/Synthesizer.ts`:
   - `clusterIntoFrontiers(papers: Paper[]) => Effect<Frontier[], LlmError | ParseError>`
   - Builds a prompt:
     ```
     System: You are a research analyst. Given a list of academic papers, cluster them
     into 4-6 thematic research frontiers. Return JSON array:
     [{ "label": "...", "summary": "...", "paperIds": ["..."] }]

     User: <paper titles and abstracts formatted as a numbered list>
     ```
   - Calls `LlmService.complete`
   - Parses the response as JSON, validates against the Frontier schema
   - On parse failure: retry up to 2 times (LLM JSON can be flaky)

4. **Implement `FrontierDiscovery`** in `apps/server/src/agents/FrontierDiscovery.ts`:
   ```typescript
   export const discover = (sessionId: string, researcherId: string) =>
     Effect.gen(function* () {
       const s2 = yield* SemanticScholarService
       const synth = yield* Synthesizer // or import directly
       const graph = yield* ResearchGraphService
       const hub = yield* WebSocketHubService

       const papers = yield* s2.getAuthorPapers(researcherId)
       const topPapers = papers
         .sort((a, b) => b.citationCount - a.citationCount)
         .slice(0, 30)

       const frontiers = yield* synth.clusterIntoFrontiers(topPapers)

       yield* graph.addFrontiers(sessionId, researcherId, frontiers)
       yield* hub.broadcast(sessionId, {
         type: "frontiers_discovered",
         nodes: frontiers.map(f => ({ type: "frontier" as const, data: f })),
         edges: frontiers.map(f => ({ source: researcherId, target: f.id, type: "has_frontier" as const })),
       })

       return frontiers
     })
   ```

5. **Implement `Orchestrator.startExploration`** in `apps/server/src/agents/Orchestrator.ts`:
   ```typescript
   export const startExploration = (sessionId: string, name: string) =>
     Effect.gen(function* () {
       const s2 = yield* SemanticScholarService
       const graph = yield* ResearchGraphService
       const hub = yield* WebSocketHubService

       // 1. Search for the researcher
       const researcher = yield* s2.searchAuthor(name)
       yield* graph.addResearcher(sessionId, researcher)
       yield* hub.broadcast(sessionId, {
         type: "researcher_found",
         node: { type: "researcher", data: researcher },
       })

       // 2. Discover frontiers (forked as a Fiber for cancellation)
       const fiber = yield* Effect.fork(
         FrontierDiscovery.discover(sessionId, researcher.id)
       )

       // 3. Track the fiber for potential cancellation
       // (store in a map managed by the Orchestrator)

       // 4. Await completion, then signal done
       yield* Fiber.join(fiber)
       yield* hub.broadcast(sessionId, {
         type: "exploration_complete",
         explorationId: sessionId,
       })
     })
   ```

6. **Add `POST /api/explore` route** in `apps/server/src/api/routes.ts`:
   - Accepts `{ name: string }` body
   - Generates a `sessionId` (e.g., `crypto.randomUUID()`)
   - Forks `Orchestrator.startExploration(sessionId, name)` — does NOT await it (the client gets the sessionId immediately and listens via WebSocket)
   - Returns `{ sessionId }`

7. **Wire the WebSocket handler** to route `ClientMessage` commands to the Orchestrator (for now, only `stop` is relevant — `expand` and `elaborate` come in Stages 7-8).

8. **Create `apps/web/src/lib/api.ts`:**
   ```typescript
   export async function explore(name: string): Promise<{ sessionId: string }> {
     const res = await fetch("/api/explore", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ name }),
     })
     return res.json()
   }
   ```

9. **Wire `SearchBar.tsx`:**
   - On submit: call `api.explore(name)`, then connect WebSocket with `ws://localhost:3001/ws` (or ensure it's already connected)
   - The `useWebSocket` hook dispatches incoming messages to Zustand
   - The `useGraph` hook syncs Zustand state to the G6 graph

10. **Remove mock data** from the store initialization (the real data now flows from the backend).

### Verify

```bash
# Terminal 1: server (with ANTHROPIC_API_KEY set)
cd apps/server && ANTHROPIC_API_KEY=sk-... bun run src/main.ts
# Terminal 2: frontend
cd apps/web && pnpm dev
```

Open `http://localhost:5173`. Type "Geoffrey Hinton" and press Enter.

**Expected:**
1. Researcher node appears within ~2s (S2 author search)
2. 4-6 frontier nodes stream in over ~5-10s (S2 papers fetch + LLM clustering)
3. Frontiers are connected to the researcher node with edges
4. The graph auto-layouts with the force simulation

---

## Stage 7: Expand Flow

**Goal:** Click "Expand" on a frontier → sub-frontier nodes appear.

> **Parallelism:** Stage 7 and Stage 8 can run in parallel (independent flows).

### Steps

1. **Implement `FrontierExpander`** in `apps/server/src/agents/FrontierExpander.ts`:
   ```typescript
   export const expand = (sessionId: string, frontierId: string, depth = 1) =>
     Effect.gen(function* () {
       const s2 = yield* SemanticScholarService
       const synth = yield* Synthesizer
       const graph = yield* ResearchGraphService
       const hub = yield* WebSocketHubService

       const frontier = yield* graph.getFrontier(sessionId, frontierId)

       // 1. Fetch citations and references for key papers (concurrent, max 5)
       const paperFetches = frontier.paperIds.map((paperId) =>
         Effect.all([
           s2.getCitations(paperId),
           s2.getReferences(paperId),
         ])
       )
       const results = yield* Effect.all(paperFetches, { concurrency: 5 })

       // 2. Deduplicate and filter out papers already in graph
       const allPapers = deduplicateById(results.flat(2))

       // 3. LLM identifies sub-frontiers
       const subFrontiers = yield* synth.identifySubFrontiers(frontier, allPapers)

       // 4. Write to graph and broadcast
       yield* graph.addFrontiers(sessionId, frontierId, subFrontiers)
       yield* hub.broadcast(sessionId, {
         type: "frontiers_discovered",
         nodes: subFrontiers.map(f => ({ type: "frontier" as const, data: f })),
         edges: subFrontiers.map(f => ({
           source: frontierId, target: f.id, type: "has_subfrontier" as const,
         })),
         parentId: frontierId,
       })
     })
   ```

2. **Add `identifySubFrontiers` to Synthesizer:**
   - Prompt: "Given this research frontier [label + summary] and these adjacent papers [titles + abstracts], identify 2-4 sub-frontiers representing where this field is heading. Return JSON array."
   - Same parse + retry pattern as `clusterIntoFrontiers`

3. **Implement `Orchestrator.expand`:**
   - Forks `FrontierExpander.expand` as a Fiber
   - Tracks the fiber for cancellation
   - Broadcasts `exploration_complete` when done

4. **Route the WS `expand` command** in the WebSocket handler:
   ```typescript
   case "expand":
     yield* Orchestrator.expand(sessionId, msg.frontierId)
     break
   ```

5. **Wire the "Expand" button in `FrontierNode.tsx`:**
   - On click, send a WebSocket message: `{ type: "expand", frontierId: node.data.id }`
   - Access the WebSocket send function via a ref or a Zustand action

6. **Position sub-frontier nodes** — the force layout should handle this naturally since sub-frontiers are connected to their parent frontier via edges. If they appear too far away, consider adding a stronger link force for `has_subfrontier` edges.

### Verify

1. Complete a search (Stage 6 flow)
2. Click "Expand" on one of the frontier nodes

**Expected:** 2-4 sub-frontier nodes appear connected to the clicked frontier, positioned nearby by the force layout. The transition is smooth (nodes animate into position).

---

## Stage 8: Elaborate Flow (Combos)

**Goal:** Click "Elaborate" on a frontier → papers and contributors appear inside a collapsible Combo.

> **Parallelism:** Stage 7 and Stage 8 can run in parallel.

### Steps

1. **Implement `PaperCollector`** in `apps/server/src/agents/PaperCollector.ts`:
   ```typescript
   export const collect = (sessionId: string, frontierId: string) =>
     Effect.gen(function* () {
       const s2 = yield* SemanticScholarService
       const graph = yield* ResearchGraphService
       const hub = yield* WebSocketHubService

       const frontier = yield* graph.getFrontier(sessionId, frontierId)

       // 1. Batch-fetch full paper details
       const papers = yield* s2.batchGetPapers(frontier.paperIds)

       // 2. Extract unique contributors
       const contributors = deduplicateById(
         papers.flatMap(p => p.authors.map(a => ({ id: a.id, name: a.name })))
       )

       // 3. Write to graph
       yield* graph.addPapers(sessionId, frontierId, papers)

       // 4. Build nodes and edges
       const paperNodes = papers.map(p => ({ type: "paper" as const, data: p }))
       const contributorNodes = contributors.map(c => ({ type: "contributor" as const, data: c }))
       const paperEdges = papers.map(p => ({ source: frontierId, target: p.id, type: "has_paper" as const }))
       const contributorEdges = contributors.map(c => ({ source: frontierId, target: c.id, type: "has_contributor" as const }))

       // 5. Broadcast
       yield* hub.broadcast(sessionId, {
         type: "papers_collected",
         nodes: [...paperNodes, ...contributorNodes],
         edges: [...paperEdges, ...contributorEdges],
         frontierId,
       })
     })
   ```

2. **Implement `Orchestrator.elaborate`:**
   - Forks `PaperCollector.collect` as a Fiber
   - Broadcasts `exploration_complete` when done

3. **Route the WS `elaborate` command** in the WebSocket handler.

4. **Add G6 Combo support** in `GraphCanvas.tsx`:
   - When `papers_collected` arrives, the frontier becomes a Combo (group node)
   - Paper and contributor nodes are children of this Combo
   - G6 v5 Combos:
     ```typescript
     // In graph config:
     combo: {
       type: "rect", // or "circle"
       style: { collapsedMarker: true },
     },
     behaviors: [...existingBehaviors, "collapse-expand"],
     ```
   - When mapping `papers_collected` to G6 data, set `combo: frontierId` on paper/contributor nodes

5. **Create `PaperNode.tsx`** in `apps/web/src/components/nodes/`:
   - Displays: title, year, citation count, TLDR (truncated)
   - Compact design to fit inside a Combo

6. **Create a Contributor node** (can reuse a simple node component):
   - Displays: name

7. **Wire the "Elaborate" button in `FrontierNode.tsx`:**
   - On click, send: `{ type: "elaborate", frontierId: node.data.id }`

8. **Update `useGraph` hook** to handle Combo creation:
   - When `papers_collected` is dispatched to the store, translate it into G6 Combo data
   - Call `graph.addComboData()` and `graph.addNodeData()` with `combo` property set

### Verify

1. Complete a search (Stage 6)
2. Click "Elaborate" on a frontier node

**Expected:** Paper nodes (showing title, year, citations, TLDR) and contributor nodes appear inside a collapsible Combo group around the frontier. Clicking the Combo's collapse control hides the children. Expanding shows them again.

---

## Stage 9: Polish — Cancellation, Errors, Fallback

**Goal:** Production-quality error handling, cancellation, and visual feedback.

### Steps

1. **Stop button + cancellation:**
   - Add a "Stop" button in `Toolbar.tsx` (visible when `activeExplorations.size > 0`)
   - On click, send WS message: `{ type: "stop" }`
   - Server-side: `Orchestrator` interrupts all active Fibers for the session using `Fiber.interruptAll`
   - Broadcasts `exploration_cancelled`
   - Frontend: `useWebSocket` handles `exploration_cancelled` → clears `activeExplorations`, shows brief toast

2. **OpenAlexService real implementation:**
   - `apps/server/src/services/OpenAlexService.ts` — implement against OpenAlex REST API
   - Base URL: `https://api.openalex.org`
   - Include `mailto` parameter for polite pool: `?mailto=your@email.com`
   - Map OpenAlex response shapes to shared `Researcher` and `Paper` schemas
   - Handle the ID mapping (OpenAlex uses `W1234567` format vs S2's `CorpusId`)

3. **Wire up the fallback pipeline** in `SemanticScholarService`:
   ```typescript
   // Wrap each S2 method with fallback
   const withFallback = <A>(s2Call: Effect<A, ApiError>, oaCall: Effect<A, ApiError>) =>
     s2Call.pipe(
       Effect.retry(
         Schedule.exponential("1 second").pipe(
           Schedule.intersect(Schedule.recurs(3)),
           Schedule.whileInput((err: ApiError) => err.status === 429),
         )
       ),
       Effect.catchTag("ApiError", () => oaCall),
     )
   ```

4. **Error toast component:**
   - Create `apps/web/src/components/ErrorToast.tsx`
   - Zustand: add `errors: string[]` and `addError(msg)` / `dismissError(index)` actions
   - `useWebSocket` dispatches `error` messages to `addError`
   - Toast auto-dismisses after 5s

5. **Loading states on nodes:**
   - When an exploration is active for a node, show a pulsing border animation
   - Track per-node loading state: `activeExplorations` stores the node ID being explored
   - In `FrontierNode.tsx` / `ResearcherNode.tsx`: check if `activeExplorations.has(nodeId)`, add CSS animation class

6. **Toolbar component** (`apps/web/src/components/Toolbar.tsx`):
   - Stop button (when explorations active)
   - Reset button (clears the graph: `store.reset()`)
   - Zoom controls: zoom in / zoom out / fit view (call `graph.zoomTo()` / `graph.fitView()`)

7. **`activeExplorations` tracking in Zustand:**
   - `setExplorationActive(nodeId)` — called when search/expand/elaborate begins
   - `setExplorationComplete(nodeId)` — called on `exploration_complete`
   - Used by: Stop button visibility, node loading states

### Verify

**Test 1 — Cancellation:**
1. Start a search
2. While frontiers are loading, click Stop
3. **Expected:** Exploration stops immediately. No more nodes stream in. Brief "Cancelled" toast appears.

**Test 2 — Rate limit fallback:**
1. Make many rapid requests to trigger S2 rate limiting (or temporarily set retry count to 0)
2. **Expected:** After S2 retries fail, OpenAlex takes over seamlessly. Data still appears (may have different coverage).

**Test 3 — Error display:**
1. Set an invalid `ANTHROPIC_API_KEY`
2. Start a search
3. **Expected:** Error toast appears with a meaningful message.

---

## Stage Dependency Graph

```
Stage 1 ─── Stage 2 ─┬─ Stage 3 ─┬─ Stage 5 ─── Stage 6 ─┬─ Stage 7 ─┬─ Stage 9
                      │           │                         │           │
                      └─ Stage 4 ─┘                         └─ Stage 8 ─┘
```

- **Sequential:** 1 → 2, 2 → 3, 2 → 4, (3 ∧ 4) → 5, 5 → 6, 6 → 7, 6 → 8, (7 ∧ 8) → 9
- **Parallel pairs:** 3 ‖ 4 (backend data vs frontend graph), 7 ‖ 8 (expand vs elaborate)

---

## Risks Summary

| # | Risk | Stage exposed | Mitigation |
|---|---|---|---|
| 1 | S2 rate limits (1 req/s without key) | Stage 3 | Get API key early via [S2 API key request](https://www.semanticscholar.org/product/api#api-key). Exponential backoff built in. |
| 2 | `@antv/g6-extension-react` compatibility | Stage 4 | Proven before backend dependency. Fallback: G6 canvas custom nodes. |
| 3 | Effect.ts + Bun WS coexistence | Stage 5 | Dedicated stage to prove integration. Fallback: Bun.serve handles both HTTP + WS directly, Effect used only for service layer. |
| 4 | LLM JSON reliability | Stage 6 | Synthesizer retries on parse failure (up to 2 retries). Structured prompt with explicit JSON format. |
