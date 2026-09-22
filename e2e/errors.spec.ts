import { expect, test } from "@playwright/test"

/**
 * Failure paths, driven by intercepting the sidecar.
 *
 * Stubbing the route rather than relying on a bad key means these run
 * identically with or without working credentials — the behaviour under test is
 * the app's, not OpenRouter's.
 */

test.describe("when the sidecar returns an error", () => {
  test("a single-request demo shows the message and keeps its content", async ({
    page,
  }) => {
    await page.route("**/api/jev/decide", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "OpenRouter rejected the API key as expired. Generate a new one at openrouter.ai/settings/keys and restart the server.",
        }),
      }),
    )

    await page.goto("/demo/triage")

    await expect(page.getByText("Request failed")).toBeVisible()
    await expect(page.getByText(/rejected the API key as expired/)).toBeVisible()

    // The page must still be usable: the ticket, the controls and the shell
    // all survive a failed request.
    await expect(page.getByText("Stripe connection keeps failing")).toBeVisible()
    await expect(page.getByRole("button", { name: "Re-ask" })).toBeEnabled()
    await expect(page.getByRole("heading", { name: "Ticket triage" })).toBeVisible()
  })

  test("a fan-out demo reports the failure without hanging", async ({ page }) => {
    await page.route("**/api/jev/batch", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Could not reach OpenRouter: timeout" }),
      }),
    )

    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    await expect(page.getByText("Request failed")).toBeVisible()
    // The button comes back rather than staying stuck in its loading state.
    await expect(page.getByRole("button", { name: "Poll 12 readers" })).toBeEnabled()
  })

  test("a partial batch failure still shows the rows that succeeded", async ({
    page,
  }) => {
    // One item errors, the rest answer. A long fan-out hitting one transient
    // upstream error must not discard everything already paid for.
    await page.route("**/api/jev/batch", async (route) => {
      const body = route.request().postDataJSON() as {
        items: Array<{ id: string }>
      }
      const results = body.items.map((item, index) =>
        index === 0
          ? { id: item.id, error: "OpenRouter returned 520" }
          : {
              id: item.id,
              answers: {
                would_act: { type: "noul", noul: 0.82 },
                lands: {
                  type: "score",
                  score: 2.4,
                  confidence: 0.8,
                  probabilities: { "0": 0.05, "1": 0.1, "2": 0.25, "3": 0.6 },
                },
              },
              usage: { input_tokens: 300, output_tokens: 20, cost: 0.0000126 },
              latencyMs: 90,
            },
      )
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results,
          usage: { input_tokens: 3300, output_tokens: 220, cost: 0.0001386 },
          wallClockMs: 240,
          replayed: false,
          source: "live",
        }),
      })
    })

    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    // Eleven readings survive; the failed one is simply absent from the panel.
    await expect(page.getByText("Lands", { exact: true })).toHaveCount(11)
    await expect(page.getByText("Request failed")).toHaveCount(0)
  })

  test("a malformed 200 is caught before it reaches a component", async ({ page }) => {
    // A 200 carrying no `answers` used to crash the render several frames
    // later, white-screening the app with the real cause only in the console.
    await page.route("**/api/jev/decide", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ nonsense: true }),
      }),
    )

    await page.goto("/demo/triage")

    await expect(page.getByRole("heading", { name: "Ticket triage" })).toBeVisible()
    await expect(page.getByText("Stripe connection keeps failing")).toBeVisible()
    await expect(page.getByText(/no answers/)).toBeVisible()
  })

  test("a malformed batch is caught too", async ({ page }) => {
    await page.route("**/api/jev/batch", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ wat: 1 }),
      }),
    )

    await page.goto("/demo/bulk")
    await page.getByRole("button", { name: "Label 60 rows" }).click()

    await expect(page.getByText("Request failed")).toBeVisible()
    await expect(page.getByRole("button", { name: "Label 60 rows" })).toBeEnabled()
  })
})

test.describe("error boundary", () => {
  test("a crashing demo does not take down the shell", async ({ page }) => {
    // Forces a render-time throw inside the demo by handing it an answer of
    // the wrong primitive for a question the component destructures.
    await page.route("**/api/jev/decide", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          model: "stub",
          answers: {
            department: { type: "choice", choice: "billing", probabilities: null },
          },
          usage: { input_tokens: 1, output_tokens: 0, cost: 0 },
          latencyMs: 1,
          replayed: false,
          source: "live",
          wire: { request: {}, response: {} },
        }),
      }),
    )

    await page.goto("/demo/triage")

    // Either the demo copes or the boundary catches it — what must not happen
    // is an empty page. The shell is the assertion.
    await expect(page.getByRole("navigation")).toBeVisible()
    await expect(page.getByRole("link", { name: /Jev POC/ })).toBeVisible()
  })
})

test.describe("when the sidecar is unreachable", () => {
  test("the shell still renders", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort("connectionrefused"))

    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: "Jev demo catalog" }),
    ).toBeVisible()
    // Mode is unknown rather than wrongly claiming to be live.
    await expect(page.getByText("live", { exact: true })).toHaveCount(0)
  })
})
