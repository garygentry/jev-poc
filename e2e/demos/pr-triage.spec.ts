import { expect, test } from "@playwright/test"

import { serverMode, waitForAnswers, watchConsole } from "../helpers"

/**
 * The PR triage's own claim: a few risk reads of one diff become the only
 * question a review queue needs — does a human have to see this — with the tier
 * set by why the change is risky, not by treating every diff alike.
 *
 * The measured head-to-head against a chat model is live-only. This suite runs
 * on fixtures, so it asserts the tiers and that the measured card is absent.
 */
test.describe("13 · PR risk triage", () => {
  test("auto-merges a trivial, contained change", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/pr-triage")
    await waitForAnswers(page)

    // The default PR is a one-character README fix. The tier label shows on both
    // the verdict badge and the policy trace's return line, so match the first.
    await expect(page.getByText("merge without review").first()).toBeVisible()
    await expect(page.getByText("no human needed")).toBeVisible()

    assertQuiet()
  })

  test("sends a security-touching change to careful review", async ({ page }) => {
    await page.goto("/demo/pr-triage")
    await page.getByRole("button", { name: "Tweak session validation" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("careful review required").first()).toBeVisible()
    await expect(page.getByText(/touches security/)).toBeVisible()
  })

  test("asks only for a glance at a wide-blast change that is tested", async ({
    page,
  }) => {
    await page.goto("/demo/pr-triage")
    await page.getByRole("button", { name: "Change a shared config default" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("a quick human glance").first()).toBeVisible()
  })

  test("keeps the measured chat-model read behind a live key", async ({ page }) => {
    await page.goto("/demo/pr-triage")
    await waitForAnswers(page)

    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(
      page.getByText("The same risk read, measured against a chat model"),
    ).toBeHidden()
  })
})
