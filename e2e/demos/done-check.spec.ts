import { expect, test } from "@playwright/test"

import { serverMode, waitForAnswers, watchConsole } from "../helpers"

/**
 * The done-check's own claim: an agent's "done" is checked against the evidence,
 * one noul per acceptance criterion in a single request, and a false "done" is
 * blocked with the failing criterion named — not a bare no.
 *
 * The measured head-to-head against a chat model is live-only: it spends real
 * money, so it never appears against a replayed gate. This suite runs on
 * fixtures, so it asserts the matrix and the verdict, and that the measured card
 * is correctly absent.
 */
test.describe("11 · done-check", () => {
  test("passes a task whose evidence backs its 'done'", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/done-check")
    await waitForAnswers(page)

    // The default example is the sound rate limiter: every criterion is met.
    await expect(page.getByText("done — every criterion met")).toBeVisible()

    assertQuiet()
  })

  test("blocks a false 'done' and names the failing criterion", async ({ page }) => {
    await page.goto("/demo/done-check")
    // The timezone fix reports green but two tests are red in its own run.
    await page.getByRole("button", { name: "Timezone parse — red suite" }).click()
    await waitForAnswers(page)

    await expect(page.getByText(/not done/)).toBeVisible()
    await expect(page.getByText(/blocked on .*tests pass/)).toBeVisible()
  })

  test("blocks a half-finished requirement on the requirement criterion", async ({
    page,
  }) => {
    await page.goto("/demo/done-check")
    // Only the retry half shipped; the required attempt history was not written.
    await page.getByRole("button", { name: "Webhook retry — half of it" }).click()
    await waitForAnswers(page)

    await expect(page.getByText(/blocked on .*meets the requirement/)).toBeVisible()
  })

  test("keeps the measured chat-model check behind a live key", async ({ page }) => {
    await page.goto("/demo/done-check")
    await waitForAnswers(page)

    // Seeded here, so the measured head-to-head — which spends real money — must
    // not render. Only a live gate earns it.
    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(
      page.getByText("The same check, measured against a chat model"),
    ).toBeHidden()
  })
})
