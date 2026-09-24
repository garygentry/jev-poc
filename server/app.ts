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
  // HEAD is answered explicitly: @hono/node-server fails on a stripped
  // c.text() body and would report a 500 to HEAD-based probes.
  app.on(["GET", "HEAD"], "/healthz", (context) => {
    const headers = { "Content-Type": "text/plain; charset=UTF-8" }
    return context.req.method === "HEAD"
      ? context.body(null, 200, headers)
      : context.body("ok", 200, headers)
  })

  app.use("*", accessMiddleware(options.access, options.verifyAccessToken))
  app.route("/api", api)

  // API misses must remain API misses and never receive the SPA shell.
  app.all("/api/*", (context) => context.json({ error: "Not found." }, 404))

  app.get("*", serveStatic({ root: clientRoot }))

  // A missing file (a stale hashed chunk after a deploy, say) is a 404, not the
  // SPA shell with a 200 that the browser and edge caches would mistake for JS.
  app.get("*", (context, next) =>
    context.req.path.startsWith("/assets/") || /\.[^/]*$/.test(context.req.path)
      ? context.notFound()
      : next(),
  )

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
