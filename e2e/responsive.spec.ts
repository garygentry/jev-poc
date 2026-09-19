import { expect, test } from "@playwright/test"

import { ROUTES } from "./helpers"

/**
 * Layout checks at phone width.
 *
 * Horizontal page scroll is the failure this exists to catch: the policy trace
 * and the wire panel both hold content wider than the viewport, and a grid item
 * without `min-w-0` lets that inflate the whole column instead of scrolling
 * inside its own panel.
 */
test.describe("at 375px", () => {
  for (const route of ROUTES) {
    test(`${route} does not scroll horizontally`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator("main")).toBeVisible()
      // Let any on-mount request settle; answers add the widest content.
      await page.waitForTimeout(1200)

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))

      expect(
        scrollWidth,
        `${route} overflows by ${scrollWidth - innerWidth}px`,
      ).toBeLessThanOrEqual(innerWidth + 1)
    })
  }

  test("the sidebar collapses and the content still reads", async ({ page }) => {
    await page.goto("/demo/triage")
    // The demo nav is desktop-only; its absence is what frees the width.
    await expect(page.getByRole("navigation")).toBeHidden()
    await expect(page.getByRole("heading", { name: "Ticket triage" })).toBeVisible()
  })

  test("wide content scrolls inside its own panel, not the page", async ({ page }) => {
    await page.goto("/demo/triage")
    await expect(page.getByText("Policy", { exact: true })).toBeVisible({
      timeout: 20_000,
    })

    const scrolls = await page
      .locator("main .overflow-x-auto")
      .first()
      .evaluate((el) => el.scrollWidth > el.clientWidth)

    expect(scrolls, "the policy trace should be the thing that scrolls").toBe(true)
  })
})
