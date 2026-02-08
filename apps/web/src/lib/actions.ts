import { Effect } from "effect"
import { useStore } from "../store/index.ts"
import { explore } from "./api.ts"
import type { ClientMessageType } from "@research-web/shared"
import type { ApiError, DecodeError } from "./errors.ts"

export const sendMessage = (msg: ClientMessageType): Effect.Effect<void> =>
  Effect.sync(() => { useStore.getState().sendWsMessage?.(msg) })

export const resetStore: Effect.Effect<void> =
  Effect.sync(() => { useStore.getState().reset() })

const markActive = (id: string): Effect.Effect<void> =>
  Effect.sync(() => { useStore.getState().setExplorationActive(id) })

export const expandFrontier = (frontierId: string): Effect.Effect<void> =>
  Effect.all([
    sendMessage({ type: "expand", frontierId }),
    markActive(frontierId),
  ]).pipe(Effect.asVoid)

export const elaborateFrontier = (frontierId: string): Effect.Effect<void> =>
  Effect.all([
    sendMessage({ type: "elaborate", frontierId }),
    markActive(frontierId),
  ]).pipe(Effect.asVoid)

export const stopExploration: Effect.Effect<void> =
  sendMessage({ type: "stop" })

export const searchResearcher = (
  name: string,
  sessionId: string
): Effect.Effect<{ sessionId: string }, ApiError | DecodeError> =>
  Effect.gen(function* () {
    yield* resetStore
    return yield* explore(name, sessionId)
  })
