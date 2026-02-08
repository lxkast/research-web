import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export const HealthResponse = Schema.Struct({
  status: Schema.String,
})

export const ExploreRequest = Schema.Struct({
  name: Schema.String,
  sessionId: Schema.String,
})

export const ExploreResponse = Schema.Struct({
  sessionId: Schema.String,
})

const apiGroup = HttpApiGroup.make("api")
  .add(
    HttpApiEndpoint.get("health", "/api/health").addSuccess(HealthResponse)
  )
  .add(
    HttpApiEndpoint.post("explore", "/api/explore")
      .addSuccess(ExploreResponse)
      .setPayload(ExploreRequest)
  )

export class Api extends HttpApi.make("research-web").add(apiGroup) {}
