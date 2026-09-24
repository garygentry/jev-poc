import { expect, test } from "@playwright/test"

/**
 * The sidecar's contract, exercised directly.
 *
 * Driven through `page.request` rather than the UI so a failure points at the
 * server rather than at a component.
 */

const QUESTIONS = {
  department: {
    type: "choice",
    instructions: "Which team should handle this ticket.",
    criteria: {
      billing: "Charges, refunds, invoices.",
      technical: "Bugs and failed integrations.",
      other: "None of the above applies.",
    },
  },
  impact: {
    type: "score",
    instructions: "How much harm is being done right now.",
    criteria: ["No harm.", "Inconvenience.", "Active revenue loss."],
  },
  is_urgent: { type: "noul", instructions: "The message conveys urgency." },
}

test.describe("GET /api/health", () => {
  test("reports a mode, a model and cumulative spend", async ({ request }) => {
    const response = await request.get("/api/health")
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(["live", "fixture"]).toContain(body.mode)
    expect(typeof body.model).toBe("string")
    expect(body.spend).toMatchObject({
      calls: expect.any(Number),
      input_tokens: expect.any(Number),
      cost: expect.any(Number),
    })
  })
})

test.describe("POST /api/jev/decide", () => {
  test("answers every question with the right primitive", async ({ request }) => {
    // No fixtureKey: a fixture is a whole recorded response and would answer
    // its own demo's questions rather than these. This exercises the contract
    // that one answer comes back per question asked.
    const response = await request.post("/api/jev/decide", {
      data: {
        state: { ticket: "Payouts have been failing for three days." },
        questions: QUESTIONS,
      },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(Object.keys(body.answers).sort()).toEqual([
      "department",
      "impact",
      "is_urgent",
    ])

    // Each primitive's shape is what downstream code branches on.
    expect(body.answers.department).toMatchObject({
      type: "choice",
      choice: expect.any(String),
      confidence: expect.any(Number),
    })
    expect(body.answers.impact).toMatchObject({
      type: "score",
      score: expect.any(Number),
      confidence: expect.any(Number),
    })
    expect(body.answers.is_urgent).toMatchObject({
      type: "noul",
      noul: expect.any(Number),
    })

    // A choice distribution covers exactly the options that were offered.
    expect(Object.keys(body.answers.department.probabilities).sort()).toEqual([
      "billing",
      "other",
      "technical",
    ])
  })

  test("replays a seeded fixture as the whole recorded response", async ({
    request,
  }) => {
    const health = await (await request.get("/api/health")).json()
    test.skip(health.mode === "live", "only applies without a key")

    const response = await request.post("/api/jev/decide", {
      data: { state: "x", questions: QUESTIONS, fixtureKey: "triage/stripe-payouts" },
    })
    const body = await response.json()

    // A fixture is a recording, not a per-question lookup — it answers the
    // demo it was captured for. The demos tolerate answers they did not ask
    // for; what matters is that the seven triage answers all arrive.
    expect(Object.keys(body.answers)).toContain("threatens_churn")
    expect(body.source).toBe("seeded")
  })

  test("carries the literal request and response back for the wire panel", async ({
    request,
  }) => {
    const response = await request.post("/api/jev/decide", {
      data: { state: "anything", questions: QUESTIONS },
    })
    const body = await response.json()

    expect(body.wire.request).toMatchObject({ model: expect.any(String) })
    expect(body.wire.response).toBeTruthy()
  })

  test("labels where the answers came from", async ({ request }) => {
    const seeded = await request.post("/api/jev/decide", {
      data: {
        state: "x",
        questions: QUESTIONS,
        fixtureKey: "triage/stripe-payouts",
      },
    })
    const health = await (await request.get("/api/health")).json()

    const body = await seeded.json()
    if (health.mode === "live") {
      expect(body.source).toBe("live")
      expect(body.replayed).toBe(false)
      expect(body.latencyMs).toBeGreaterThan(0)
    } else {
      expect(body.source).toBe("seeded")
      expect(body.replayed).toBe(true)
      // No round trip happened, so no figure is reported for one.
      expect(body.latencyMs).toBe(0)
    }
  })

  test("falls back to a synthetic answer when a fixture is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/jev/decide", {
      data: { state: "x", questions: QUESTIONS, fixtureKey: "triage/no-such-key" },
    })
    const body = await response.json()
    const health = await (await request.get("/api/health")).json()

    // A missing fixture must not fail the request — but it must be labelled
    // differently from a seeded one, because it means nothing.
    if (health.mode !== "live") expect(body.source).toBe("synthetic")
    expect(body.answers.department.type).toBe("choice")
  })

  test("rejects a request with no questions", async ({ request }) => {
    const response = await request.post("/api/jev/decide", {
      data: { state: "x", questions: {} },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toMatch(/No questions/)
  })
})

test.describe("POST /api/jev/batch", () => {
  test("answers each item against its own state", async ({ request }) => {
    const items = ["a", "b", "c"].map((id) => ({
      id,
      state: { feedback: `row ${id}` },
    }))

    const response = await request.post("/api/jev/batch", {
      data: { items, questions: { is_urgent: QUESTIONS.is_urgent } },
    })
    expect(response.ok()).toBe(true)

    const body = await response.json()
    // Order is preserved, which the demos rely on to zip results back.
    expect(body.results.map((row: { id: string }) => row.id)).toEqual(["a", "b", "c"])
    expect(body.usage).toMatchObject({ input_tokens: expect.any(Number) })
    expect(body.wallClockMs).toBeGreaterThanOrEqual(0)
  })

  test("clamps the batch to the server's row cap", async ({ request }) => {
    const items = Array.from({ length: 500 }, (_, index) => ({
      id: `r${index}`,
      state: { feedback: "x" },
    }))

    const response = await request.post("/api/jev/batch", {
      data: { items, questions: { is_urgent: QUESTIONS.is_urgent } },
    })
    const body = await response.json()

    // 200 is the cap in server/config.ts. The client is not trusted for this.
    expect(body.results.length).toBe(200)
  })

  test("clamps concurrency even when the client asks for more", async ({
    request,
  }) => {
    const response = await request.post("/api/jev/batch", {
      data: {
        items: [{ id: "a", state: "x" }],
        questions: { is_urgent: QUESTIONS.is_urgent },
        concurrency: 10_000,
      },
    })
    // Nothing observable to assert beyond it not falling over; the cap itself
    // is unit-tested. This pins that an absurd value is survivable.
    expect(response.ok()).toBe(true)
  })

  test("rejects an empty batch", async ({ request }) => {
    const response = await request.post("/api/jev/batch", {
      data: { items: [], questions: QUESTIONS },
    })
    expect(response.status()).toBe(400)
  })
})

test.describe("spend meter", () => {
  test("the removed reset endpoint is not accepted", async ({ request }) => {
    const response = await request.post("/api/jev/spend/reset")
    expect(response.status()).toBe(404)
    expect(response.headers()["content-type"]).toContain("application/json")
  })

  test("counts only real calls", async ({ request }) => {
    const before = await (await request.get("/api/health")).json()

    await request.post("/api/jev/decide", {
      data: {
        state: "x",
        questions: QUESTIONS,
        fixtureKey: "triage/stripe-payouts",
      },
    })

    const after = await (await request.get("/api/health")).json()
    if (after.mode === "live") {
      expect(after.spend.calls).toBe(before.spend.calls + 1)
    } else {
      // A replayed answer costs nothing and must not appear in the meter.
      expect(after.spend.calls).toBe(before.spend.calls)
      expect(after.spend.cost).toBe(before.spend.cost)
    }
  })
})
