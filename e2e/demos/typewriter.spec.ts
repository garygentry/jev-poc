import { expect, test } from "@playwright/test"

import { readWire, waitForAnswers, watchConsole } from "../helpers"

test.describe("04 · live typewriter", () => {
  test("judges a draft on twelve questions in one request", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/typewriter")
    await waitForAnswers(page)

    const { request } = await readWire(page)
    expect(Object.keys(request.questions as object)).toHaveLength(12)

    assertQuiet()
  })

  test("re-asks when the draft changes", async ({ page }) => {
    await page.goto("/demo/typewriter")
    await waitForAnswers(page)

    await page.getByRole("button", { name: "Leaks a credential" }).click()
    await expect(page.getByText("contains secret")).toBeVisible()
    // The seeded answer for this draft puts contains_secret at 0.99.
    await expect(page.locator("main")).toContainText("99.0%")
  })

  test("waits for enough text before asking at all", async ({ page }) => {
    await page.goto("/demo/typewriter")
    await waitForAnswers(page)

    await page.getByLabel("Your draft").fill("too short")
    await expect(page.getByText("Waiting for enough text to judge.")).toBeVisible()
    await expect(page.getByText(/40 needed before asking/)).toBeVisible()
  })

  test("does not queue a request per keystroke", async ({ page }) => {
    await page.goto("/demo/typewriter")
    await waitForAnswers(page)

    let calls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/jev/decide")) calls += 1
    })

    // Typed as one burst inside the debounce window.
    await page
      .getByLabel("Your draft")
      .fill(
        "The staging deploy is failing on the migration step and I need someone to look before Thursday.",
      )
    await page.waitForTimeout(1500)

    expect(calls, "debounce should collapse a burst into one call").toBeLessThanOrEqual(2)
  })
})
