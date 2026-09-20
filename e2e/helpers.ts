import { expect, type Page } from "@playwright/test"

/**
 * Attach a console/pageerror recorder.
 *
 * Returns a function that asserts nothing was logged. Called at the end of a
 * test rather than per-navigation, so one React warning anywhere in a flow
 * fails the test that caused it.
 */
export function watchConsole(page: Page) {
  const problems: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const text = message.text()
      // The dev server's own noise, not the app's.
      if (text.includes("Download the React DevTools")) return
      problems.push(`[${message.type()}] ${text}`)
    }
  })
  page.on("pageerror", (error) => problems.push(`[pageerror] ${error.message}`))

  return () => expect(problems, problems.join("\n")).toEqual([])
}

/** The server reports whether a key is configured; several assertions depend on it. */
export async function serverMode(page: Page): Promise<"live" | "fixture"> {
  const response = await page.request.get("/api/health")
  expect(response.ok()).toBe(true)
  return (await response.json()).mode
}

/**
 * Wait for a demo to have finished asking.
 *
 * The demos that ask on mount race the test, so every assertion about answers
 * has to wait for one to land rather than for a fixed delay.
 */
export async function waitForAnswers(page: Page) {
  await expect(page.getByText("On the wire")).toBeVisible({ timeout: 20_000 })
}

/**
 * Open the wire panel and return the parsed request and response JSON.
 *
 * Targets the panel's own testid rather than `pre`, because the policy trace
 * is also a `<pre>` and sits above it on several demos.
 */
export async function readWire(page: Page) {
  await page.getByRole("button", { name: /On the wire/ }).click()

  const json = page.getByTestId("wire-json")
  await expect(json).toBeVisible()
  const requestText = await json.innerText()

  await page.getByRole("tab", { name: "Response" }).click()
  const responseText = await page.getByTestId("wire-json").innerText()

  return {
    request: JSON.parse(requestText) as Record<string, unknown>,
    response: JSON.parse(responseText) as Record<string, unknown>,
  }
}

/** Every page in the app, for the sweeps that visit all of them. */
export const ROUTES = [
  "/",
  "/method",
  "/demo/triage",
  "/demo/guardrail",
  "/demo/rerank",
  "/demo/typewriter",
  "/demo/taxonomy",
  "/demo/router",
  "/demo/bulk",
  "/demo/personas",
  "/demo/cascade",
  "/demo/context-pruner",
  "/demo/done-check",
  "/demo/loop-detector",
  "/demo/pr-triage",
] as const

/** How a demo is driven to ask: on mount, or behind a named run button. */
export type AskTrigger = { on: "mount" } | { on: "click"; button: RegExp }

/**
 * The demo roster the contract sweep loops over.
 *
 * This is the one list that grows by a line when a demo is added — the price of
 * a Node test runner that cannot import the Vite-resolved registry. It carries
 * only what the contract needs: how to make the demo ask, and whether it fans
 * out (and so must never fire on render). Everything a demo claims for *itself*
 * lives in `e2e/demos/<slug>.spec.ts`.
 */
export interface DemoCase {
  slug: string
  /** A short name for the test titles. */
  title: string
  ask: AskTrigger
  fansOut: boolean
}

export const DEMOS: DemoCase[] = [
  { slug: "triage", title: "ticket triage", ask: { on: "mount" }, fansOut: false },
  { slug: "guardrail", title: "command guardrail", ask: { on: "mount" }, fansOut: false },
  { slug: "rerank", title: "semantic re-rank", ask: { on: "click", button: /Re-rank \d+ passages/ }, fansOut: true },
  { slug: "typewriter", title: "live typewriter", ask: { on: "mount" }, fansOut: false },
  { slug: "taxonomy", title: "taxonomy beam search", ask: { on: "click", button: /Descend the tree/ }, fansOut: false },
  { slug: "router", title: "model router", ask: { on: "mount" }, fansOut: false },
  { slug: "bulk", title: "bulk labelling", ask: { on: "click", button: /Label \d+ rows/ }, fansOut: true },
  { slug: "personas", title: "persona panel", ask: { on: "click", button: /Poll \d+ readers/ }, fansOut: true },
  { slug: "cascade", title: "cascade router", ask: { on: "mount" }, fansOut: false },
  { slug: "context-pruner", title: "context pruner", ask: { on: "click", button: /Prune \d+ chunks/ }, fansOut: true },
  { slug: "done-check", title: "done-check", ask: { on: "mount" }, fansOut: false },
  { slug: "loop-detector", title: "loop detector", ask: { on: "click", button: /Read \d+ windows/ }, fansOut: true },
  { slug: "pr-triage", title: "PR risk triage", ask: { on: "mount" }, fansOut: false },
]

/**
 * Navigate to a demo and make it ask once, however it asks.
 *
 * Waits for the wire panel, which every demo shows once it has answered — a
 * fan-out is given longer because it is N round trips, not one.
 */
export async function askDemo(page: Page, demo: DemoCase) {
  await page.goto(`/demo/${demo.slug}`)
  if (demo.ask.on === "click") {
    await page.getByRole("button", { name: demo.ask.button }).click()
  }
  await expect(page.getByText("On the wire")).toBeVisible({
    timeout: demo.fansOut ? 60_000 : 20_000,
  })
}
