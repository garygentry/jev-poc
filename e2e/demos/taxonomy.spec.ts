import { expect, test } from "@playwright/test"

import { watchConsole } from "../helpers"

test.describe("05 · taxonomy beam search", () => {
  test("descends three levels, one request per level", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/taxonomy")

    let calls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/jev/decide")) calls += 1
    })

    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    await expect(page.locator("main")).toContainText(
      "Technical › Delivery › Webhook not firing",
    )
    await expect(page.getByText("Level 3 · one request")).toBeVisible()
    expect(calls, "one request per level, not per branch").toBe(3)

    assertQuiet()
  })

  test("carries several branches when the model is genuinely torn", async ({
    page,
  }) => {
    // The SSO ticket is the one live Jev is unsure about at the top level —
    // account 0.88, technical 0.07, billing 0.05 — so the beam has something
    // to carry. On a decisive ticket it collapses to one, which is the next
    // test.
    await page.goto("/demo/taxonomy")
    await page.getByRole("button", { name: "SSO rollout" }).click()
    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    const level2 = page.getByText("Level 2 · one request").locator("..")
    await expect(level2.locator("li")).toHaveCount(3)
    await expect(page.locator("main")).toContainText("Account › Access › SSO setup")
  })

  test("collapses to one branch when the model is certain", async ({ page }) => {
    // The webhook ticket comes back technical at probability 1.0, so pruning
    // leaves nothing beside it. The beam buying nothing here is a real result,
    // not a failure — and the demo says so rather than implying otherwise.
    await page.goto("/demo/taxonomy")
    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    const level1 = page.getByText("Level 1 · one request").locator("..")
    await expect(level1.locator("li")).toHaveCount(1)
    await expect(page.getByText("Greedy would have reached the same leaf.")).toBeVisible()
  })

  test("commits above a leaf when the children are not separable", async ({
    page,
  }) => {
    await page.goto("/demo/taxonomy")
    await page.getByRole("button", { name: "Ambiguous inside billing" }).click()
    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText("Stopped above a leaf.")).toBeVisible()
    await expect(page.getByText(/rather than guessing/)).toBeVisible()
  })

  test("says whether the beam beat greedy on this input", async ({ page }) => {
    await page.goto("/demo/taxonomy")
    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    // Either verdict is fine; silently implying the beam did work it did not
    // is the thing being guarded against.
    await expect(
      page.getByText(/The beam earned its keep here\.|Greedy would have reached the same leaf\./),
    ).toBeVisible()
  })
})
