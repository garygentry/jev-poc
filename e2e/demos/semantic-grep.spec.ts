import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The semantic grep's own claim: one noul per function judges each against a
 * rule stated in English, finding the calls a regex misses and skipping the ones
 * it would flag for a timeout it cannot see.
 *
 * The matching is deterministic on fixtures; Jev's measured cost is live-only.
 * This suite runs on fixtures, so it asserts the hits and the regex's mistakes.
 */
test.describe("16 · semantic grep", () => {
  const search = /Search \d+ functions/

  test("matches by meaning where the regex over- and under-matches", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/semantic-grep")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: search }).click()

    // Four true matches across fetch, axios, and got; the regex catches five,
    // because it hits two calls that set a timeout.
    await expect(page.getByText("Jev matched 4, the regex matched 5")).toBeVisible()
    // And both failure modes are named on the rows.
    await expect(page.getByText("regex false match").first()).toBeVisible()
    await expect(page.getByText("regex missed it")).toBeVisible()

    assertQuiet()
  })
})
