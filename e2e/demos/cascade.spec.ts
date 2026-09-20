import { expect, test } from "@playwright/test"

import { serverMode, waitForAnswers, watchConsole } from "../helpers"

/**
 * The cascade's own claim: a cheap Jev gate routes each request to a tier, and
 * the routine ones land on Haiku while the rest go to Opus.
 *
 * The measured head-to-head that runs the actual work on both tiers is
 * live-only — it spends real money on chat models, so it never appears against
 * a replayed gate. This suite runs on fixtures, so it asserts the gate and the
 * routing, and that the measured card is correctly absent.
 */
test.describe("09 · cascade router", () => {
  test("routes a routine, low-stakes request to the cheap tier", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/cascade")
    await waitForAnswers(page)

    // The default example is a balance lookup: routine, and nothing irreversible.
    await expect(page.locator("main")).toContainText("anthropic/claude-haiku-4.5")
    await expect(page.getByText(/routine → Haiku/)).toBeVisible()
    await expect(page.getByText("chosen").first()).toBeVisible()

    assertQuiet()
  })

  test("promotes a request that turns on expert judgement to the frontier", async ({
    page,
  }) => {
    await page.goto("/demo/cascade")
    // The contested annual-plan refund reads as expert work.
    await page.getByRole("button", { name: "Refund a disputed annual plan" }).click()
    await waitForAnswers(page)

    await expect(page.locator("main")).toContainText("anthropic/claude-opus-5")
  })

  test("keeps the measured work behind a live key, never on a replay", async ({
    page,
  }) => {
    await page.goto("/demo/cascade")
    await waitForAnswers(page)

    // The gate is seeded here, so the two-tier measured comparison — which spends
    // real money — must not render. Only a live gate earns it.
    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(page.getByText("The work, measured on both tiers")).toBeHidden()
  })
})
