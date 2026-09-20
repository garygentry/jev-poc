import { expect, test } from "@playwright/test"

import { DEMOS, askDemo, serverMode, watchConsole } from "./helpers"

/**
 * The properties every demo must have, asserted by looping the roster rather
 * than restating them eight (and, later, twenty) times. A demo joins the sweep
 * by adding one row to `DEMOS` in `helpers.ts`; the claims peculiar to it live
 * in `e2e/demos/<slug>.spec.ts`.
 *
 * Two contract properties are enforced elsewhere and are not duplicated here:
 * the server-side row/concurrency cap in `api.spec.ts`, and graceful failure on
 * a 502 (single-request and fan-out) in `errors.spec.ts`.
 */
for (const demo of DEMOS) {
  test.describe(`contract · ${demo.title}`, () => {
    test("renders, asks in one flow, and shows the wire and its source", async ({
      page,
    }) => {
      const assertQuiet = watchConsole(page)
      await askDemo(page, demo)

      await expect(page.locator("main")).toBeVisible()

      // The offline shape calls nothing, so it has no wire and no source badge —
      // its contract is only that it renders. Everything else asks and shows one.
      if (!demo.offline) {
        await expect(page.getByText("On the wire")).toBeVisible()

        // Replayed answers are always badged; a live answer needs none, so the
        // assertion is gated on the mode the suite pins itself to.
        if ((await serverMode(page)) === "fixture") {
          await expect(
            page.getByText(/Seeded fixture|Synthetic/).first(),
          ).toBeVisible()
        }
      }

      assertQuiet()
    })
  })
}

/**
 * A fan-out is the only shape whose cost scales with its input, so it carries
 * two obligations no single-call demo does: it must not spend a cent because a
 * page was opened, and it must say what a run will cost before the run.
 */
for (const demo of DEMOS.filter((demo) => demo.fansOut)) {
  test.describe(`contract · ${demo.title} · fan-out`, () => {
    test("does not fire on render, and projects its cost first", async ({
      page,
    }) => {
      let calls = 0
      page.on("request", (request) => {
        if (request.url().includes("/api/jev/batch")) calls += 1
      })

      await page.goto(`/demo/${demo.slug}`)
      await expect(page.getByText(/projected if run live/)).toBeVisible()

      await page.waitForTimeout(1200)
      expect(calls, "a fan-out must never fire on render").toBe(0)
    })
  })
}
