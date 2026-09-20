import { expect, test } from "@playwright/test"

import { serverMode, watchConsole } from "../helpers"

test.describe("03 · semantic re-rank", () => {
  test("fans out one request per passage and re-orders them", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/rerank")

    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.getByText("Jev re-rank")).toBeVisible()
    await expect(page.locator("main")).toContainText("Rotating a leaked API key", {
      timeout: 30_000,
    })

    // The gold passage for q1 is p05, and it should lead the re-ranked column.
    const reranked = page.getByText("Jev re-rank").locator("../..")
    await expect(reranked.locator("li").first()).toContainText("p05")

    assertQuiet()
  })

  test("reports ranks as ranges on both sides, never a tie-broken position", async ({
    page,
  }) => {
    await page.goto("/demo/rerank")
    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.locator("main")).toContainText("Rotating a leaked API key", {
      timeout: 30_000,
    })

    // The keyword baseline ties five passages at one word each, so it must
    // show a range. A bare "#1" there would be the sort speaking, not the
    // scorer.
    const baseline = page.getByText("Keyword baseline").locator("../..")
    await expect(baseline.locator("li").first()).toContainText("#1–5")
    await expect(page.getByText(/Ties are reported as/)).toBeVisible()
  })

  test("withholds the accuracy scoreboard when the answers were replayed", async ({
    page,
  }) => {
    await page.goto("/demo/rerank")
    test.skip((await serverMode(page)) === "live", "only applies without a key")

    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.getByText("No accuracy figure without a key.")).toBeVisible({
      timeout: 30_000,
    })
    // A hit rate computed from fixtures would be a fabricated result.
    await expect(page.getByText("Gold rank, re-ranked")).toHaveCount(0)
  })
})
