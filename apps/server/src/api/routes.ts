import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export const HealthResponse = Schema.Struct({
  status: Schema.String,
})

const apiGroup = HttpApiGroup.make("api").add(
  HttpApiEndpoint.get("health", "/api/health").addSuccess(HealthResponse)
)

export class Api extends HttpApi.make("research-web").add(apiGroup) {}
