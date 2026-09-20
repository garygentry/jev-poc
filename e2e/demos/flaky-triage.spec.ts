import { expect, test } from "@playwright/test"

import { serverMode, waitForAnswers, watchConsole } from "../helpers"

/**
 * The flaky triage's own claim: a CI failure is classified from its output —
 * flaky, regression, or infra — and a confidence gate lets code auto-retry only
 * the failures that would actually pass on a re-run, surfacing the rest so an
 * auto-retry never hides a real regression behind a green light.
 *
 * The measured head-to-head is live-only. This suite runs on fixtures, so it
 * asserts the action per failure and that the measured card is absent.
 */
test.describe("14 · flaky vs regression", () => {
  test("auto-retries a nondeterministic flake", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/flaky-triage")
    await waitForAnswers(page)

    // The default failure is a UI timing race that passed on the last 41 runs.
    // "auto-retry" is also in the tagline and thesis, so match the verdict badge.
    await expect(page.getByText("auto-retry", { exact: true })).toBeVisible()

    assertQuiet()
  })

  test("blocks on a reproduced regression instead of retrying it", async ({ page }) => {
    await page.goto("/demo/flaky-triage")
    await page.getByRole("button", { name: "Regression — a wrong status code" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("block — real regression")).toBeVisible()
  })

  test("surfaces an uninformative failure to a human", async ({ page }) => {
    await page.goto("/demo/flaky-triage")
    await page.getByRole("button", { name: "Unclear — an uninformative log" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("surface to an engineer")).toBeVisible()
    // Distinct from the `unclear` option's own criterion text on the page.
    await expect(page.getByText(/does not say enough to classify/)).toBeVisible()
  })

  test("keeps the measured chat-model classification behind a live key", async ({
    page,
  }) => {
    await page.goto("/demo/flaky-triage")
    await waitForAnswers(page)

    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(
      page.getByText("The same classification, measured against a chat model"),
    ).toBeHidden()
  })
})
