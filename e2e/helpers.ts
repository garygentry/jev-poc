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
  "/demo/triage",
  "/demo/guardrail",
  "/demo/rerank",
  "/demo/typewriter",
  "/demo/taxonomy",
  "/demo/router",
  "/demo/bulk",
  "/demo/personas",
] as const
