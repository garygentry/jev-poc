import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createApp } from "./app.ts"

let clientRoot: string

beforeAll(async () => {
  clientRoot = await mkdtemp(path.join(tmpdir(), "jev-client-"))
  await writeFile(
    path.join(clientRoot, "index.html"),
    "<!doctype html><title>Jev test SPA</title>",
  )
  await writeFile(path.join(clientRoot, "asset.txt"), "asset")
})

afterAll(async () => {
  await rm(clientRoot, { recursive: true, force: true })
})

describe("production app", () => {
  const app = () => createApp({ clientRoot })

  it("exposes a minimal external health route", async () => {
    const response = await app().request("/healthz")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("ok")

    const head = await app().request("/healthz", { method: "HEAD" })
    expect(head.status).toBe(200)
  })

  it("returns 404, not the SPA shell, for missing files", async () => {
    for (const requestPath of ["/assets/index-stale.js", "/missing.css"]) {
      const response = await app().request(requestPath)
      expect(response.status).toBe(404)
      expect(response.headers.get("content-type") ?? "").not.toContain("text/html")
    }
  })

  it("serves static files and the SPA fallback", async () => {
    const staticResponse = await app().request("/asset.txt")
    expect(staticResponse.status).toBe(200)
    expect(await staticResponse.text()).toBe("asset")

    const headResponse = await app().request("/asset.txt", { method: "HEAD" })
    expect(headResponse.status).toBe(200)
    expect(await headResponse.text()).toBe("")

    const routeResponse = await app().request("/demo/triage")
    expect(routeResponse.status).toBe(200)
    expect(routeResponse.headers.get("content-type")).toContain("text/html")
    expect(await routeResponse.text()).toContain("Jev test SPA")
  })

  it("never falls through from API routes to the SPA", async () => {
    for (const requestPath of ["/api", "/api/not-a-route"]) {
      const getResponse = await app().request(requestPath)
      expect(getResponse.status).toBe(404)
      expect(getResponse.headers.get("content-type")).toContain("application/json")
    }

    const postResponse = await app().request("/api/jev/spend/reset", {
      method: "POST",
    })
    expect(postResponse.status).toBe(404)
    expect(postResponse.headers.get("content-type")).toContain("application/json")
  })

  it("does not serve files or SPA HTML for non-GET requests", async () => {
    for (const requestPath of ["/", "/asset.txt", "/method"]) {
      const response = await app().request(requestPath, { method: "POST" })
      expect(response.status).toBe(404)
      expect(response.headers.get("content-type")).not.toContain("text/html")
    }
  })
})
