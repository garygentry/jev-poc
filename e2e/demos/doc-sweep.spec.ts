import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The doc sweep's own claim: a document too long for one context is swept in
 * overlapping chunks — chunk, judge, aggregate — finding a disclosure buried in
 * the middle, and stating what chunking costs in the same view.
 *
 * The aggregation is deterministic on fixtures; Jev's measured cost is live-only.
 * This suite runs on fixtures, so it asserts the finding and the honesty note.
 */
test.describe("19 · long-document sweep", () => {
  const sweep = /Sweep \d+ chunks/

  test("finds the buried disclosure and states the chunking cost", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/doc-sweep")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: sweep }).click()

    // The advertising and business-partners sections are the needle.
    await expect(page.getByText("found — the policy discloses this")).toBeVisible()
    await expect(page.getByText("disclosure").first()).toBeVisible()
    // The honesty the demo insists on is on the page.
    await expect(page.getByText(/What chunking costs/)).toBeVisible()

    assertQuiet()
  })
})
