import { expect, test } from "@playwright/test"

import { waitForAnswers, watchConsole } from "../helpers"

test.describe("06 · model router", () => {
  test("routes a trivial request to the cheapest model", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/router")
    await waitForAnswers(page)

    await expect(page.locator("main")).toContainText("claude-haiku-4-5")
    await expect(page.getByText("trivial capability → Haiku 4.5")).toBeVisible()

    assertQuiet()
  })

  test("routes an expert, long-context request to the top model", async ({ page }) => {
    await page.goto("/demo/router")
    await page.getByRole("button", { name: "Plan a migration over a large repo" }).click()
    await waitForAnswers(page)

    await expect(page.locator("main")).toContainText("claude-opus-5")
    await expect(page.getByText(/needs more than 200k context/)).toBeVisible()
  })

  test("asks for clarification instead of routing an underspecified request", async ({
    page,
  }) => {
    await page.goto("/demo/router")
    await page.getByRole("button", { name: "Too vague to route" }).click()
    await waitForAnswers(page)

    // "Make the dashboard better" is the one prompt live Jev calls ambiguous
    // (0.85) once the question distinguishes an unclear goal from missing
    // material. Its capability read is weak too (0.26), so it is promoted
    // rather than acted on — two independent reasons not to route it blind.
    await expect(page.getByText("Clarify before sending")).toBeVisible()
    await expect(page.getByText(/confident — promoted/)).toBeVisible()
  })

  test("shows the cost of the ladder it chose from", async ({ page }) => {
    await page.goto("/demo/router")
    await waitForAnswers(page)

    await expect(page.getByText("The ladder")).toBeVisible()
    await expect(page.locator("main")).toContainText("$8.00")
    await expect(page.locator("main")).toContainText("$40.00")
    await expect(page.getByText(/\$32\.00 saved/)).toBeVisible()
  })
})
