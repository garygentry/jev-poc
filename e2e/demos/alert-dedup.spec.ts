import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

/**
 * The alert dedup's own claim: asking "same incident?" of each pair clusters a
 * storm by the underlying event, where a template rule both over-groups alerts
 * that share a shape and splits one incident across unlike messages.
 *
 * The clustering is deterministic on fixtures; Jev's measured cost is live-only.
 * This suite runs on fixtures, so it asserts the incident grouping and the
 * template rule's mistakes.
 */
test.describe("15 · alert dedup", () => {
  const compare = /Compare \d+ pairs/

  test("clusters by incident where the template rule mis-groups", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/alert-dedup")

    // A fan-out never fires on render — it projects first, then runs on click.
    await expect(page.getByText(/projected if run live/)).toBeVisible()
    await page.getByRole("button", { name: compare }).click()

    // The DB pool storm is one incident across three alerts plus three
    // singletons — four incidents, where the template rule keys out five groups.
    await expect(page.getByText("4 incidents, not 5 template groups")).toBeVisible()
    // And the template rule fuses the two unrelated p99 latency alerts.
    await expect(page.getByText("merges 2 incidents")).toBeVisible()

    assertQuiet()
  })

  test("clusters a second storm around its real incident", async ({ page }) => {
    await page.goto("/demo/alert-dedup")
    await page.getByRole("button", { name: "A bad deploy" }).click()
    await page.getByRole("button", { name: compare }).click()

    // The deploy, the error spike, and the new-handler 500s are one incident;
    // the backup and the cache warning are their own.
    await expect(page.getByText(/^3 incidents/)).toBeVisible()
  })
})
