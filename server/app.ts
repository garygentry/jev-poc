import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  accessMiddleware,
  type AccessConfig,
  type AccessTokenVerifier,
} from "./access.ts"
import { api } from "./routes.ts"

export interface AppOptions {
  access: AccessConfig
  verifyAccessToken?: AccessTokenVerifier
  clientRoot?: string
}

const DEFAULT_CLIENT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client",
)

export function createApp(options: AppOptions): Hono {
  const app = new Hono()
  const clientRoot = options.clientRoot ?? DEFAULT_CLIENT_ROOT

  // Cloudflare and external uptime checks bypass Access only on this exact path.
  app.get("/healthz", (context) => context.text("ok"))

  app.use("*", accessMiddleware(options.access, options.verifyAccessToken))
  app.route("/api", api)

  // API misses must remain API misses and never receive the SPA shell.
  app.all("/api/*", (context) => context.json({ error: "Not found." }, 404))

  app.get("*", serveStatic({ root: clientRoot }))

  // BrowserRouter owns non-file GET routes. Hono automatically answers HEAD
  // requests for GET handlers without turning non-GET requests into HTML.
  app.get(
    "*",
    serveStatic({
      root: clientRoot,
      rewriteRequestPath: () => "/index.html",
    }),
  )

  return app
}
