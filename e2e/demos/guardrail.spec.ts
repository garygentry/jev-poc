import { expect, test } from "@playwright/test"

import { waitForAnswers, watchConsole } from "../helpers"

test.describe("02 · command guardrail", () => {
  test("allows a confidently read-only command", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/guardrail")
    await waitForAnswers(page)

    await expect(page.getByText("Allow", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("clear of the 70% gate")

    assertQuiet()
  })

  test("refuses the exfiltration one-liner", async ({ page }) => {
    await page.goto("/demo/guardrail")
    await page.getByRole("button", { name: "exfiltrate .env" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("Refuse", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("never run by the agent")
  })

  test("holds `cat .env` for confirmation because it touches secrets", async ({ page }) => {
    // The counterpart to the exfiltration test above. Live Jev reads `cat .env`
    // as read_only — a bare file read is recoverable — so the blast radius alone
    // would allow it. The secrets hard stop is what catches it, forcing a prompt
    // rather than a refusal. Reading a secret earns a prompt; sending it off the
    // machine earns a refusal, and that gap is the demo's point.
    await page.goto("/demo/guardrail")
    await page.getByRole("button", { name: "cat .env", exact: true }).click()
    await waitForAnswers(page)

    await expect(page.getByText("Ask first", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("touches secrets")
  })

  test("prompts on a command that reaches for the network", async ({ page }) => {
    // `rm -rf node_modules && pnpm install` reads as reversible, and the hard
    // stop catches the second half of it.
    await page.goto("/demo/guardrail")
    await page.getByRole("button", { name: "rm -rf node_modules" }).click()
    await waitForAnswers(page)

    await expect(page.getByText("Ask first")).toBeVisible()
    await expect(page.locator("main")).toContainText("network egress")
  })

  test("shows a different gate per blast radius", async ({ page }) => {
    await page.goto("/demo/guardrail")
    await waitForAnswers(page)

    const table = page.getByText("Confidence needed to auto-allow").locator("..").locator("..")
    await expect(table).toContainText("70%")
    await expect(table).toContainText("90%")
    await expect(table).toContainText("always asks")
    await expect(table).toContainText("refused")
  })
})
