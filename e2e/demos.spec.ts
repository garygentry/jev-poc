import { expect, test } from "@playwright/test"

import { readWire, serverMode, waitForAnswers, watchConsole } from "./helpers"

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
    // Ticket 3's business_impact comes back with confidence 0.03 — a flat
    // distribution. Showing a pin at 0.62 would invite acting on nothing.
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

  test("stops `cat .env` even though it is read-only", async ({ page }) => {
    // The hard stop is the point: strictly read-only, and still not safe to
    // run unattended.
    await page.goto("/demo/guardrail")
    await page.getByRole("button", { name: "cat .env", exact: true }).click()
    await waitForAnswers(page)

    await expect(page.getByText("Ask first")).toBeVisible()
    await expect(page.locator("main")).toContainText(
      "Needs confirmation: touches secrets.",
    )
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

test.describe("03 · semantic re-rank", () => {
  test("fans out one request per passage and re-orders them", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/rerank")

    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.getByText("Jev re-rank")).toBeVisible()
    await expect(page.locator("main")).toContainText("Rotating a leaked API key", {
      timeout: 30_000,
    })

    // The gold passage for q1 is p05, and it should lead the re-ranked column.
    const reranked = page.getByText("Jev re-rank").locator("../..")
    await expect(reranked.locator("li").first()).toContainText("p05")

    assertQuiet()
  })

  test("reports ranks as ranges on both sides, never a tie-broken position", async ({
    page,
  }) => {
    await page.goto("/demo/rerank")
    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.locator("main")).toContainText("Rotating a leaked API key", {
      timeout: 30_000,
    })

    // The keyword baseline ties five passages at one word each, so it must
    // show a range. A bare "#1" there would be the sort speaking, not the
    // scorer.
    const baseline = page.getByText("Keyword baseline").locator("../..")
    await expect(baseline.locator("li").first()).toContainText("#1–5")
    await expect(page.getByText(/Ties are reported as/)).toBeVisible()
  })

  test("withholds the accuracy scoreboard when the answers were replayed", async ({
    page,
  }) => {
    await page.goto("/demo/rerank")
    test.skip((await serverMode(page)) === "live", "only applies without a key")

    await page.getByRole("button", { name: /Re-rank 24 passages/ }).click()
    await expect(page.getByText("No accuracy figure without a key.")).toBeVisible({
      timeout: 30_000,
    })
    // A hit rate computed from fixtures would be a fabricated result.
    await expect(page.getByText("Gold rank, re-ranked")).toHaveCount(0)
  })
})

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

  test("carries more than one branch at a time", async ({ page }) => {
    await page.goto("/demo/taxonomy")
    await page.getByRole("button", { name: "Descend the tree" }).click()
    await expect(page.getByText("Committed to")).toBeVisible({ timeout: 30_000 })

    // Level 2 keeps Delivery and Ingestion alive — that is the beam.
    const level2 = page.getByText("Level 2 · one request").locator("..")
    await expect(level2.locator("li")).toHaveCount(2)
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

    await expect(page.getByText("Clarify before sending")).toBeVisible()
    await expect(page.getByText(/flat distribution — promoted/)).toBeVisible()
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

test.describe("07 · bulk labelling", () => {
  test("does not run until asked", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/bulk")

    let calls = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/jev/batch")) calls += 1
    })
    await page.waitForTimeout(1200)
    expect(calls, "a fan-out must never fire on render").toBe(0)

    await expect(page.getByText(/Nothing runs until you click/)).toBeVisible()
    assertQuiet()
  })

  test("labels a batch and queues what it could not call", async ({ page }) => {
    await page.goto("/demo/bulk")
    await page.getByRole("button", { name: "Label 60 rows" }).click()

    await expect(page.getByText("Human review queue")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("Sentiment", { exact: true })).toBeVisible()
    await expect(page.getByText(/rows confident enough to count/).first()).toBeVisible()
    await expect(page.getByText(/excluded from the counts above/)).toBeVisible()
  })

  test("withholds cost and timing when the answers were not real", async ({ page }) => {
    await page.goto("/demo/bulk")
    test.skip((await serverMode(page)) === "live", "only applies without a key")

    await page.getByRole("button", { name: "Label 60 rows" }).click()
    await expect(page.getByText("No cost or timing figures without a key.")).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText("Total cost")).toHaveCount(0)
  })

  test("offers no row count above the server's cap", async ({ page }) => {
    await page.goto("/demo/bulk")
    const counts = await page
      .getByText("Rows", { exact: true })
      .locator("..")
      .getByRole("button")
      .allInnerTexts()
    expect(Math.max(...counts.map(Number))).toBeLessThanOrEqual(200)
  })
})

test.describe("08 · persona panel", () => {
  test("polls every persona and reads the spread", async ({ page }) => {
    const assertQuiet = watchConsole(page)
    await page.goto("/demo/personas")

    await page.getByRole("button", { name: "Poll 12 readers" }).click()

    // "Would act" is also each persona card's gauge label, so the summary's
    // own copy is picked out by the figure beside it.
    await expect(page.getByText("6 of 12")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("least useful number here")).toBeVisible()
    await expect(page.getByText("Staff engineer")).toBeVisible()

    // One card per persona.
    await expect(page.getByText("Lands", { exact: true })).toHaveCount(12)

    assertQuiet()
  })

  test("names the split rather than reporting only a mean", async ({ page }) => {
    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Poll 12 readers" }).click()
    await expect(page.getByText("The panel splits.")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/describes neither group/)).toBeVisible()
  })

  test("distinguishes a split panel from a lukewarm one", async ({ page }) => {
    // The two drafts sit at almost the same mean. If the UI only showed a mean
    // it could not tell them apart, which is the whole demo.
    await page.goto("/demo/personas")
    await page.getByRole("button", { name: "Outcome pitch" }).click()
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
