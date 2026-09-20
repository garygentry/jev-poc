import { expect, test } from "@playwright/test"

import { readWire, waitForAnswers, watchConsole } from "../helpers"

test.describe("01 · ticket triage", () => {
  test("asks seven questions in one request and routes on the answers", async ({
    page,
  }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/triage")
    await waitForAnswers(page)

    await expect(page.locator("main")).toContainText("technical/priority")
    await expect(page.getByText("Auto-routed")).toBeVisible()

    // Seven named answers, and the wire proves they rode in one request.
    const { request } = await readWire(page)
    const questions = request.questions as Record<string, unknown>
    expect(Object.keys(questions)).toHaveLength(7)
    expect(Object.keys(questions).sort()).toEqual([
      "business_impact",
      "department",
      "frustration",
      "is_repeat_contact",
      "is_urgent",
      "refund_requested",
      "threatens_churn",
    ])

    assertQuiet()
  })

  test("escalates the chargeback threat to retention", async ({ page }) => {
    await page.goto("/demo/triage")
    await page.getByRole("button", { name: "Fourth contact, threatening chargeback" }).click()
    await waitForAnswers(page)

    await expect(page.locator("main")).toContainText("retention")
    await expect(page.getByText("Human first")).toBeVisible()
    await expect(page.getByText("churn threat")).toBeVisible()
  })

  test("renders a flat score as 'cannot tell' rather than as a value", async ({
    page,
  }) => {
    // Ticket 3's business_impact comes back at confidence 0.09, distributed
    // 0.38 / 0.40 / 0.22 — about as undecided as an answer gets. Showing a pin
    // at 0.84 would invite acting on nothing.
    await page.goto("/demo/triage")
    await page.getByRole("button", { name: "Fourth contact, threatening chargeback" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("Cannot tell").first()).toBeVisible()
    await expect(page.getByText(/must not be acted on/).first()).toBeVisible()
  })

  test("highlights the policy branch that actually fired", async ({ page }) => {
    await page.goto("/demo/triage")
    await waitForAnswers(page)

    await expect(page.getByText("Policy", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("IMPACT_THRESHOLD")
  })
})
