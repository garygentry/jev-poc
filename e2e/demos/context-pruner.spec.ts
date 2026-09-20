import { expect, test } from "@playwright/test"

import { serverMode, watchConsole } from "../helpers"

/**
 * The context pruner's own claim: one relevance noul per chunk, and the saving
 * is the tokens of the chunks it drops.
 *
 * The token accounting is deterministic and works on fixtures; the dollar
 * projection and Jev's measured cost are live-only. This suite runs on
 * fixtures, so it asserts the pruning and the token counts, and that the
 * measured dollars are correctly withheld.
 */
test.describe("10 · context pruner", () => {
  test("keeps the relevant chunks and drops the distractors", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/context-pruner")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: /Prune \d+ chunks/ }).click()

    await expect(page.getByText("The saving is the tokens not sent")).toBeVisible()

    // The default scenario (EU checkout timeout) keeps the logs and config, and
    // drops the marketing copy and the support macro.
    const main = page.locator("main")
    await expect(main.getByText("keep").first()).toBeVisible()
    await expect(main.getByText("drop").first()).toBeVisible()
    await expect(main).toContainText("dropped")

    assertQuiet()
  })

  test("reports the token saving exactly, and withholds dollars off a live run", async ({
    page,
  }) => {
    await page.goto("/demo/context-pruner")
    await page.getByRole("button", { name: /Prune \d+ chunks/ }).click()
    await expect(page.getByText("The saving is the tokens not sent")).toBeVisible()

    // The token columns are exact and need no key.
    await expect(page.getByText("Full context", { exact: true })).toBeVisible()
    await expect(page.getByText("Not sent", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("tok")

    // On fixtures, the projected dollars and the measured cost are held back.
    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(page.getByText(/appear against a live run/)).toBeVisible()
    await expect(page.getByText("Saved per turn")).toBeHidden()
  })
})
