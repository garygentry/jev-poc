import { expect, test } from "@playwright/test"

import { serverMode, watchConsole } from "../helpers"

test.describe("07 · bulk labelling", () => {
  test("says plainly that nothing runs until asked", async ({ page }) => {
    // That a fan-out never fires on render is asserted for every fan-out in
    // contract.spec.ts; what is bulk's own is the copy that tells the visitor
    // so, next to the control that will spend.
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/bulk")

    await expect(page.getByText(/Nothing runs until you click/)).toBeVisible()
    assertQuiet()
  })

  test("labels a batch and queues what it could not call", async ({ page }) => {
    await page.goto("/demo/bulk")
    await page.getByRole("button", { name: "Label 60 rows" }).click()

    await expect(page.getByText("Human review queue")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("Sentiment", { exact: true })).toBeVisible()
    await expect(page.getByText(/rows confident enough to count/).first()).toBeVisible()

    // The queue spans every label, not just the first one charted — live Jev
    // called all 60 rows by sentiment and only 44 by theme.
    await expect(page.getByText(/any.*label came back/)).toBeVisible()
    await expect(page.getByText(/should not be in the totals/)).toBeVisible()
  })

  test("withholds cost and timing when the answers were not real", async ({ page }) => {
    await page.goto("/demo/bulk")
    test.skip((await serverMode(page)) === "live", "only applies without a key")

    await page.getByRole("button", { name: "Label 60 rows" }).click()
    await expect(page.getByText("No cost or timing figures without a key.")).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText("Total cost")).toHaveCount(0)
  })

  test("offers no row count above the server's cap", async ({ page }) => {
    await page.goto("/demo/bulk")
    const counts = await page
      .getByText("Rows", { exact: true })
      .locator("..")
      .getByRole("button")
      .allInnerTexts()
    expect(Math.max(...counts.map(Number))).toBeLessThanOrEqual(200)
  })
})
