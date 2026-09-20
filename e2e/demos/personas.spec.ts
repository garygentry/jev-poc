import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

test.describe("08 · persona panel", () => {
  test("polls every persona and reads the spread", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/personas")

    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    // One card per persona. The counts themselves are model output and are
    // asserted only where the demo makes a claim about their shape.
    await expect(page.getByText("Lands", { exact: true })).toHaveCount(12, {
      timeout: 60_000,
    })
    await expect(page.getByText("least useful number here")).toBeVisible()
    await expect(page.getByText("Staff engineer")).toBeVisible()
    await expect(page.getByText("Would act").first()).toBeVisible()

    assertQuiet()
  })

  test("names the split rather than reporting only a mean", async ({ page }) => {
    // Live Jev splits the panel on the *outcome* pitch — four would act, three
    // would not, five on the fence. The seeded fixtures had put the split on
    // the technical pitch; the drafts were guesses and the model disagreed.
    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Outcome pitch" }).click()
    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    await expect(page.getByText("The panel splits.")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/describes neither group/)).toBeVisible()
  })

  test("distinguishes a split panel from one that simply lands badly", async ({
    page,
  }) => {
    // The hype pitch is not divisive, it is just disliked: nobody would act,
    // and the panel agrees about that. A mean alone cannot tell "half of them
    // love it" from "none of them do", and this is the second case.
    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Hype pitch" }).click()
    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    await expect(page.getByText("No real split.")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/broadly agrees/)).toBeVisible()
  })

  test("keeps the caveat about what twelve invented readers are worth", async ({
    page,
  }) => {
    await page.goto("/demo/personas")
    await expect(
      page.getByText("Twelve invented readers are not a market."),
    ).toBeVisible()
  })
})
