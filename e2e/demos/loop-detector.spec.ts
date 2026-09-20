import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The loop detector's own claim: a sliding window reads "no progress" off the
 * trace, so it stops a real loop at its onset and never cuts a run that is still
 * advancing — the two ways a blind max-iteration counter gets it wrong.
 *
 * The step counts are deterministic and work on fixtures; Jev's measured cost is
 * live-only. This suite runs on fixtures, so it asserts the verdict and the
 * comparison against the counter for each shape of run.
 */
test.describe("12 · loop detector", () => {
  const runButton = /Read \d+ windows/

  test("catches a run that circles, and prices it against the counter", async ({
    page,
  }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/loop-detector")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: runButton }).click()

    // The default trace debugs for a few steps, then loops from step 3.
    await expect(page.getByText(/circling from step 3/)).toBeVisible()
    await expect(page.getByText(/lets burn that the detector never pays for/)).toBeVisible()
    await expect(page.getByText(/counter .* stops here/)).toBeVisible()

    assertQuiet()
  })

  test("never cuts a long run that keeps advancing", async ({ page }) => {
    await page.goto("/demo/loop-detector")
    await page.getByRole("button", { name: "Refactor — long but always advancing" }).click()
    await page.getByRole("button", { name: runButton }).click()

    // Twelve progressing steps: no loop, and the counter would have cut it short.
    await expect(page.getByText(/still advancing at step 12/)).toBeVisible()
    await expect(page.getByText(/short of the work it was about to finish/)).toBeVisible()
    await expect(page.getByText(/circling from step/)).toBeHidden()
  })

  test("does not flag a short stall the agent breaks out of", async ({ page }) => {
    await page.goto("/demo/loop-detector")
    await page.getByRole("button", { name: "Stalls briefly, then breaks out" }).click()
    await page.getByRole("button", { name: runButton }).click()

    await expect(page.getByText(/no loop — finished in 10 steps/)).toBeVisible()
    await expect(page.getByText(/circling from step/)).toBeHidden()
  })
})
