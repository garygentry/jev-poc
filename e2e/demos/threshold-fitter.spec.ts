import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The threshold fitter's own claim: it reads recorded, labelled answers and
 * sweeps the threshold to find the one that best separates them — the number the
 * other demos guess — making no model calls at all.
 *
 * It is the offline shape, so there is no wire and nothing to run; everything is
 * computed from committed data. This suite asserts the fit and its comparison to
 * the guess render.
 */
test.describe("20 · threshold fitter", () => {
  test("fits a threshold from the labels and beats the guess", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/threshold-fitter")

    // The fit lands at 0.65 on this labelled set, above the 0.5 a demo guesses.
    await expect(page.getByText(/fitted 65%/).first()).toBeVisible()
    await expect(page.getByText(/guess 50%/).first()).toBeVisible()
    await expect(page.getByText("F1 across every threshold")).toBeVisible()
    await expect(page.getByText("Drag the threshold")).toBeVisible()

    // Offline: it calls nothing, so there is no wire panel.
    await expect(page.getByText("On the wire")).toBeHidden()

    assertQuiet()
  })
})
