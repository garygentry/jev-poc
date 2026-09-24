import { serve } from "@hono/node-server"
import type { Server } from "node:http"

import { createApp } from "./app.ts"
import { ACCESS_CONFIG, MODE, MODEL, PORT } from "./config.ts"

const app = createApp({ access: ACCESS_CONFIG })
const server = serve(
  { fetch: app.fetch, hostname: "0.0.0.0", port: PORT },
  (info) => {
    console.log(`  jev server    http://0.0.0.0:${info.port}`)
    console.log(`  mode          ${MODE}`)
    console.log(
      `  model         ${MODE === "live" ? MODEL : "— set OPENROUTER_API_KEY to go live"}`,
    )
    console.log(`  access        ${ACCESS_CONFIG.enabled ? "required" : "disabled"}`)
  },
) as Server

let shuttingDown = false

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`  shutdown      ${signal}`)

  const deadline = setTimeout(() => {
    server.closeAllConnections()
    process.exit(1)
  }, 4_000)
  deadline.unref()

  server.close((error) => {
    clearTimeout(deadline)
    if (error) {
      console.error("Server shutdown failed.")
      process.exitCode = 1
    }
  })
  server.closeIdleConnections()
}

process.once("SIGTERM", shutdown)
process.once("SIGINT", shutdown)
