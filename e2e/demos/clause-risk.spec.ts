import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The clause risk demo's own claim: four risk questions per clause, fanned
 * across the contract, surface only the clauses that carry risk — the
 * boilerplate stays quiet.
 *
 * The surfaced count is deterministic on fixtures; Jev's measured cost is
 * live-only. This suite runs on fixtures, so it asserts the surfacing.
 */
test.describe("18 · clause risk", () => {
  const read = /Read \d+ clauses/

  test("surfaces the risky clauses and leaves the boilerplate quiet", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/clause-risk")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: read }).click()

    // Four of the eight clauses carry risk; the rest are boilerplate.
    await expect(page.getByText(/4 of 8 clauses/)).toBeVisible()
    await expect(page.getByText("Every clause, on every risk")).toBeVisible()
    // The surfaced clauses are badged for review.
    await expect(page.getByText("review").first()).toBeVisible()

    assertQuiet()
  })
})
