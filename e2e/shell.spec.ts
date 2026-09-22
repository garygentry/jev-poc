import { expect, test } from "@playwright/test"

import { DEMOS, ROUTES, serverMode, watchConsole } from "./helpers"

test.describe("app shell", () => {
  test("the gallery lists every demo with its shape", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: "Jev demo catalog" }),
    ).toBeVisible()

    // Derived from the roster rather than hardcoded, so a new demo does not
    // need this number edited — the gallery cards and the sidebar link to the
    // same set, so `main` alone counts each once.
    const expected = DEMOS.length
    const gallery = page.locator("main")
    const cards = gallery.locator("a[href^='/demo/']")
    await expect(cards).toHaveCount(expected)

    // Every summary card carries both the request shape and the same primitive
    // chips shown on its demo page.
    for (const label of ["Questions", "States", "Requests"]) {
      await expect(gallery.getByText(label, { exact: true })).toHaveCount(expected)
    }
    for (const card of await cards.all()) {
      await expect(card.locator(".font-mono.rounded-full").first()).toBeVisible()
    }

    assertQuiet()
  })

  test("every route renders without console errors", async ({ page }) => {
    const assertQuiet = watchConsole(page)

    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.locator("main")).toBeVisible()
      // A crashed lazy chunk leaves the frame but no heading.
      await expect(page.locator("main h1, main h2")).not.toHaveCount(0)
    }

    assertQuiet()
  })

  test("the sidebar navigates between demos", async ({ page }) => {
    await page.goto("/")
    // Scoped to the nav: the gallery cards link to the same places.
    const sidebar = page.getByRole("navigation")

    await sidebar.getByRole("link", { name: /Taxonomy beam search/ }).click()
    await expect(page).toHaveURL(/\/demo\/taxonomy$/)
    await expect(
      page.getByRole("heading", { name: "Taxonomy beam search" }),
    ).toBeVisible()

    await sidebar.getByRole("link", { name: /Persona panel/ }).click()
    await expect(page).toHaveURL(/\/demo\/personas$/)

    await sidebar.getByRole("link", { name: "Home" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("heading", { name: "Jev demo catalog" }),
    ).toBeVisible()
  })

  test("an unknown demo slug falls back to the gallery", async ({ page }) => {
    await page.goto("/demo/does-not-exist")
    await expect(page.getByText(/No demo called/)).toBeVisible()
  })

  test("an unknown route redirects home", async ({ page }) => {
    await page.goto("/nonsense")
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("heading", { name: "Jev demo catalog" }),
    ).toBeVisible()
  })

  test("the theme survives navigation", async ({ page }) => {
    await page.goto("/")
    const html = page.locator("html")
    await expect(html).toHaveClass(/dark/)

    await page.getByRole("button", { name: "Switch to light theme" }).click()
    await expect(html).not.toHaveClass(/dark/)

    // This is the bug the persisted toggle fixes: it used to reset on every
    // navigation because the choice lived in component state.
    await page.goto("/demo/triage")
    await expect(html).not.toHaveClass(/dark/)

    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
  })

  test("the header reports the server's mode", async ({ page }) => {
    await page.goto("/")
    const mode = await serverMode(page)
    await expect(
      page.getByText(mode === "live" ? "live" : "fixture mode", { exact: true }),
    ).toBeVisible()
  })
})

test.describe("the suite's own premise", () => {
  test("runs against fixtures, not the live model", async ({ page }) => {
    // If this ever fails, the webServer config has regressed and the rest of
    // the suite is asserting against model output — which would be flaky and
    // would cost money on every run.
    expect(await serverMode(page)).toBe("fixture")
  })
})

test.describe("no-key state", () => {
  test("says plainly that nothing shown is a real judgement", async ({ page }) => {
    await page.goto("/")
    test.skip((await serverMode(page)) === "live", "only applies without a key")

    await expect(
      page.getByText("Running without a key — nothing here is a real judgement"),
    ).toBeVisible()
    await expect(page.getByText("hand-seeded")).toBeVisible()
  })
})
