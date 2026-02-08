# Research Web

Interactive graph-based map of a researcher's landscape, powered by an agentic swarm that discovers frontiers, expands into adjacent fields, and elaborates with papers and contributors.

## Tech stack

Turborepo monorepo: Bun + Effect TS server, React 19 + Vite frontend, shared schema package.

## Prerequisites

- Node.js
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.9`)
- Bun (server runtime)

## Setup

1. `pnpm install`
2. Create `apps/server/.env` with:
   - `ANTHROPIC_API_KEY` — Anthropic/Claude API key
   - `OPENALEX_API_KEY` — OpenAlex API key
   - `S2_API_KEY` — Semantic Scholar API key (optional)

## Development

- `pnpm dev` — starts server (:3001) and web (:5173) concurrently via Turbo
- Web proxies `/api` and `/ws` to the server automatically

## Build & test

- `pnpm build` — build all packages
- `pnpm test` — run tests
- `pnpm typecheck` — type-check all packages

## Project structure

```
apps/server/    — Bun + Effect TS backend (HTTP + WebSocket)
apps/web/       — React 19 + Vite frontend (@antv/g6 graph)
packages/shared — Shared Effect schemas and types
```

## See also

- `EFFECTS.md` — effect model documentation
