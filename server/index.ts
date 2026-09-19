import { serve } from "@hono/node-server"
import { Hono } from "hono"

import { MODE, MODEL, PORT } from "./config.ts"
import { api } from "./routes.ts"

const app = new Hono()
app.route("/api", api)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`  jev sidecar   http://localhost:${info.port}`)
  console.log(`  mode          ${MODE}`)
  console.log(`  model         ${MODE === "live" ? MODEL : "— paste a key into .env to go live"}`)
})
