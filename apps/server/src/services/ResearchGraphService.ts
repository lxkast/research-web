import { Context, Effect, Layer } from "effect"
import type { Researcher, Paper, Frontier } from "@research-web/shared"

interface SessionState {
  researchers: Map<string, Researcher>
  frontiers: Map<string, Frontier>
  papers: Map<string, Paper>
  edges: Array<{ source: string; target: string; type: string }>
}

export interface ResearchGraphServiceI {
  readonly getOrCreateSession: (sessionId: string) => Effect.Effect<void>
  readonly addResearcher: (sessionId: string, researcher: Researcher) => Effect.Effect<void>
  readonly addFrontiers: (sessionId: string, parentId: string, frontiers: readonly Frontier[]) => Effect.Effect<void>
  readonly getFrontier: (sessionId: string, frontierId: string) => Effect.Effect<Frontier>
  readonly addPapers: (sessionId: string, frontierId: string, papers: readonly Paper[]) => Effect.Effect<void>
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
        for (const f of frontiers) {
          session.frontiers.set(f.id, f)
          session.edges.push({ source: parentId, target: f.id, type: "has_frontier" })
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
  }
})
