import { Context, Effect, Layer } from "effect"
import type { Researcher, Paper, Frontier } from "@research-web/shared"

interface SessionState {
  researchers: Map<string, Researcher>
  frontiers: Map<string, Frontier>
  papers: Map<string, Paper>
  edges: Array<{ source: string; target: string; type: string }>
  expandedFrontiers: Set<string>
  frontierDepths: Map<string, number>
}

export interface ResearchGraphServiceI {
  readonly getOrCreateSession: (sessionId: string) => Effect.Effect<void>
  readonly addResearcher: (sessionId: string, researcher: Researcher) => Effect.Effect<void>
  readonly addFrontiers: (sessionId: string, parentId: string, frontiers: readonly Frontier[]) => Effect.Effect<void>
  readonly getFrontier: (sessionId: string, frontierId: string) => Effect.Effect<Frontier>
  readonly addPapers: (sessionId: string, frontierId: string, papers: readonly Paper[]) => Effect.Effect<void>
  readonly markExpanded: (sessionId: string, frontierId: string) => Effect.Effect<void>
  readonly getUnexpandedFrontiers: (sessionId: string, maxDepth: number) => Effect.Effect<Array<{ frontier: Frontier; depth: number }>>
}

export class ResearchGraphService extends Context.Tag("ResearchGraphService")<
  ResearchGraphService,
  ResearchGraphServiceI
>() {}

export const ResearchGraphServiceStub = Layer.succeed(ResearchGraphService, {
  getOrCreateSession: () => Effect.die("not implemented"),
  addResearcher: () => Effect.die("not implemented"),
  addFrontiers: () => Effect.die("not implemented"),
  getFrontier: () => Effect.die("not implemented"),
  addPapers: () => Effect.die("not implemented"),
  markExpanded: () => Effect.die("not implemented"),
  getUnexpandedFrontiers: () => Effect.die("not implemented"),
})

export const ResearchGraphServiceLive = Layer.sync(ResearchGraphService, () => {
  const sessions = new Map<string, SessionState>()

  const ensureSession = (sessionId: string): SessionState => {
    let session = sessions.get(sessionId)
    if (!session) {
      session = {
        researchers: new Map(),
        frontiers: new Map(),
        papers: new Map(),
        edges: [],
        expandedFrontiers: new Set(),
        frontierDepths: new Map(),
      }
      sessions.set(sessionId, session)
    }
    return session
  }

  return {
    getOrCreateSession: (sessionId) =>
      Effect.sync(() => { ensureSession(sessionId) }),

    addResearcher: (sessionId, researcher) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        session.researchers.set(researcher.id, researcher)
      }),

    addFrontiers: (sessionId, parentId, frontiers) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        const parentDepth = session.frontierDepths.get(parentId)
        const childDepth = parentDepth !== undefined ? parentDepth + 1 : 0
        for (const f of frontiers) {
          session.frontiers.set(f.id, f)
          session.edges.push({ source: parentId, target: f.id, type: "has_frontier" })
          session.frontierDepths.set(f.id, childDepth)
        }
      }),

    getFrontier: (sessionId, frontierId) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        const frontier = session.frontiers.get(frontierId)
        if (!frontier) throw new Error(`Frontier ${frontierId} not found`)
        return frontier
      }),

    addPapers: (sessionId, frontierId, papers) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        for (const p of papers) {
          session.papers.set(p.id, p)
          session.edges.push({ source: frontierId, target: p.id, type: "has_paper" })
        }
      }),

    markExpanded: (sessionId, frontierId) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        session.expandedFrontiers.add(frontierId)
      }),

    getUnexpandedFrontiers: (sessionId, maxDepth) =>
      Effect.sync(() => {
        const session = ensureSession(sessionId)
        const results: Array<{ frontier: Frontier; depth: number }> = []
        for (const [id, frontier] of session.frontiers) {
          const depth = session.frontierDepths.get(id) ?? 0
          if (depth < maxDepth && !session.expandedFrontiers.has(id)) {
            results.push({ frontier, depth })
          }
        }
        results.sort((a, b) =>
          a.depth !== b.depth
            ? a.depth - b.depth
            : a.frontier.paperIds.length - b.frontier.paperIds.length
        )
        return results
      }),
  }
})
