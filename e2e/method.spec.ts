import { expect, test } from "@playwright/test"

import { watchConsole } from "./helpers"

/**
 * The `/method` page is the spine of the tour: the one page that explains the
 * three primitives, why a request carries one state, how a threshold turns a
 * probability into an action, and the honesty rules the demos are built to keep.
 *
 * It makes no upstream calls, so unlike the per-demo specs there is nothing to
 * wait for — these assertions are about the page rendering and the header
 * reaching it. The honesty-rules check is deliberate: if the page ever stops
 * stating them, that is a regression worth failing on.
 */
test.describe("the method page", () => {
  test("renders every band without console errors", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/method")

    await expect(
      page.getByRole("heading", { name: "How to read every demo" }),
    ).toBeVisible()

    for (const heading of [
      "Choice, Score, Noul",
      "Why a request carries one state",
      "Turning a probability into an action",
      "What this repo will not do",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible()
    }

    // The three primitives are named as their wire types.
    for (const primitive of ["choice", "score", "noul"]) {
      await expect(page.getByText(primitive, { exact: true })).toBeVisible()
    }

    assertQuiet()
  })

  test("the header links to it from anywhere in the tour", async ({ page }) => {
    await page.goto("/")

    // Scoped to the header banner: the sidebar and gallery link to demos, not
    // to /method, but scoping keeps this honest if that ever changes.
    await page.getByRole("banner").getByRole("link", { name: "Method" }).click()
    await expect(page).toHaveURL(/\/method$/)
    await expect(
      page.getByRole("heading", { name: "How to read every demo" }),
    ).toBeVisible()
  })

  test("states the honesty rules it holds the demos to", async ({ page }) => {
    await page.goto("/method")

    // The load-bearing promise: nothing measured is ever estimated in.
    await expect(page.getByText(/withheld, not estimated/)).toBeVisible()
    // And a projected price is never reported as a real cost.
    await expect(page.getByText(/only ever used to/)).toBeVisible()
  })

  test("links back home", async ({ page }) => {
    await page.goto("/method")
    await page.getByRole("link", { name: /Back to Home/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("heading", { name: "Jev demo catalog" }),
    ).toBeVisible()
  })
})
