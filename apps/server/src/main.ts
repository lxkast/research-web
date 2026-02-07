import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { Api } from "./api/routes.js"
import {
  SemanticScholarServiceStub,
  OpenAlexServiceStub,
  LlmServiceStub,
  ResearchGraphServiceStub,
  WebSocketHubServiceStub,
} from "./services/index.js"

const ApiGroupLive = HttpApiBuilder.group(Api, "api", (handlers) =>
  handlers.handle("health", () =>
    Effect.succeed({ status: "ok" })
  )
)

const ApiLive = HttpApiBuilder.api(Api).pipe(Layer.provide(ApiGroupLive))

const ServiceStubs = Layer.mergeAll(
  SemanticScholarServiceStub,
  OpenAlexServiceStub,
  LlmServiceStub,
  ResearchGraphServiceStub,
  WebSocketHubServiceStub,
)

const ServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(ServiceStubs),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: 3001 })),
)

BunRuntime.runMain(Layer.launch(ServerLive))
