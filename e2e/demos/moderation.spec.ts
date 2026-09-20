import { expect, test } from "@playwright/test"

import { serverMode, waitForAnswers, watchConsole } from "../helpers"

/**
 * The moderation demo's own claim: twelve policies are judged against one piece
 * of content in one request, each on its own threshold, so a death threat and a
 * spam link do not answer to the same cutoff.
 *
 * The measured chat-model head-to-head is live-only. This suite runs on
 * fixtures, so it asserts the per-content action and the matrix.
 */
test.describe("17 · multi-policy moderation", () => {
  test("allows a benign message — nothing trips", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/moderation")
    await waitForAnswers(page)

    await expect(page.getByText("no policy tripped")).toBeVisible()
    await expect(page.getByText("Twelve policies, one request")).toBeVisible()

    assertQuiet()
  })

  test("does not flag harsh criticism as harassment", async ({ page }) => {
    await page.goto("/demo/moderation")
    await page.getByRole("button", { name: "Harsh but fair criticism" }).click()
    await waitForAnswers(page)

    // The per-policy thresholds are what keep frustration out of the queue.
    await expect(page.getByText("no policy tripped")).toBeVisible()
  })

  test("blocks a violent threat", async ({ page }) => {
    await page.goto("/demo/moderation")
    await page.getByRole("button", { name: "A violent threat" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("block", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/tripped:.*Violent threat/)).toBeVisible()
  })

  test("queues a scam for review", async ({ page }) => {
    await page.goto("/demo/moderation")
    await page.getByRole("button", { name: "A crypto scam" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("queue for review").first()).toBeVisible()
    await expect(page.getByText(/tripped:.*Spam/)).toBeVisible()
  })

  test("keeps the measured chat-model run behind a live key", async ({ page }) => {
    await page.goto("/demo/moderation")
    await waitForAnswers(page)

    test.skip((await serverMode(page)) === "live", "only applies without a key")
    await expect(
      page.getByText("All twelve, measured against a chat model"),
    ).toBeHidden()
  })
})
