import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { manifest } from "./demo"

import {
  BASELINE_MODEL,
  CHAT_PRICES,
  compareAll,
  parseBaseline,
  projectCost,
  promptFor,
  schemaFor,
} from "@shared/baseline.ts"

import type { SystemOneResponse } from "@shared/jev.ts"

/**
 * Validate the baseline harness against the committed `triage` fixtures before
 * any demo is built on it (expansion plan §5, Phase 1). The harness has to
 * understand the *real* question set and the *real* answers, not a toy one — a
 * bug here would mis-shape every measured comparison downstream.
 */

const fixtures = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../fixtures/triage.json",
    ),
    "utf8",
  ),
) as Record<string, SystemOneResponse>

describe("schemaFor(triage.questions)", () => {
  const { schema } = schemaFor(manifest.questions)
  const props = schema.properties as Record<string, Record<string, unknown>>

  it("covers every question, strictly", () => {
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(Object.keys(manifest.questions))
    expect(Object.keys(props)).toEqual(Object.keys(manifest.questions))
  })

  it("maps a choice to an enum of exactly its offered options", () => {
    const department = manifest.questions.department
    if (department?.type !== "choice") throw new Error("triage lost its choice")
    expect(props.department).toMatchObject({
      type: "string",
      enum: Object.keys(department.criteria),
    })
  })

  it("maps a score to a 0-indexed integer bounded by its levels", () => {
    // frustration has three levels, so valid answers are 0, 1, 2.
    expect(props.frustration).toMatchObject({
      type: "integer",
      minimum: 0,
      maximum: 2,
    })
  })

  it("maps a noul to a probability on 0-1", () => {
    expect(props.is_urgent).toMatchObject({ type: "number", minimum: 0, maximum: 1 })
  })
})

describe("promptFor", () => {
  it("carries each question's instructions and criteria into the prompt", () => {
    const { user, system } = promptFor(
      manifest.stateFor(manifest.examples[0]!.input),
      manifest.questions,
    )
    expect(system).toMatch(/classifier/i)
    // The ticket body and an option description both reach the model.
    expect(user).toContain("Stripe")
    expect(user).toContain("Charges, refunds, invoices")
  })
})

describe("parseBaseline", () => {
  it("coerces a well-formed object into comparable answers", () => {
    const answers = parseBaseline(
      {
        department: "technical",
        frustration: 1,
        business_impact: 2,
        is_urgent: 0.9,
        threatens_churn: 0.1,
        refund_requested: 0,
        is_repeat_contact: 0.2,
      },
      manifest.questions,
    )
    expect(answers.department).toEqual({ type: "choice", choice: "technical" })
    expect(answers.frustration).toEqual({ type: "score", score: 1 })
    expect(answers.is_urgent).toEqual({ type: "noul", noul: 0.9 })
  })

  it("rounds an out-of-range score to a valid level and clamps a noul", () => {
    const answers = parseBaseline(
      {
        department: "billing",
        frustration: 9, // above the top level
        business_impact: 1,
        is_urgent: 1.4, // above 1
        threatens_churn: -0.2, // below 0
        refund_requested: 0,
        is_repeat_contact: 0,
      },
      manifest.questions,
    )
    expect(answers.frustration).toEqual({ type: "score", score: 2 })
    expect(answers.is_urgent).toEqual({ type: "noul", noul: 1 })
    expect(answers.threatens_churn).toEqual({ type: "noul", noul: 0 })
  })

  it("rejects a choice the question never offered", () => {
    expect(() =>
      parseBaseline({ ...validRaw(), department: "legal" }, manifest.questions),
    ).toThrow(/offered option/)
  })

  it("rejects a missing field rather than dropping it", () => {
    const { department: _drop, ...missing } = validRaw()
    expect(() => parseBaseline(missing, manifest.questions)).toThrow(/omitted/)
  })
})

describe("compareAll against the committed Jev fixtures", () => {
  it("compares every fixture without throwing, and never invents a third verdict", () => {
    for (const [key, response] of Object.entries(fixtures)) {
      // Flatten the recorded Jev answers into the baseline's own shape, so the
      // comparison runs against a real answer set rather than a hand-made one.
      const asBaseline = parseBaseline(flatten(response), manifest.questions)
      const rows = compareAll(manifest.questions, response.answers, asBaseline)
      expect(rows, key).toHaveLength(Object.keys(manifest.questions).length)
      // A model compared with itself agrees everywhere — the harness adds no
      // disagreement of its own, and reports only `agree`, never "correct".
      for (const row of rows) {
        expect(row, `${key}/${row.name}`).toHaveProperty("agree", true)
        expect(row).not.toHaveProperty("correct")
      }
    }
  })
})

describe("chat prices carry the recorded data point, not a re-derived one", () => {
  it("keeps Haiku 4.5 as the baseline at its dated $1/$5 price", () => {
    expect(BASELINE_MODEL).toBe("anthropic/claude-haiku-4.5")
    expect(CHAT_PRICES[BASELINE_MODEL]).toMatchObject({ inputPerM: 1, outputPerM: 5 })
  })

  it("projects a frontier alternative over a measured token count", () => {
    const usage = { input_tokens: 690, output_tokens: 40, cost: 0.00079 }
    const opus = projectCost(usage, CHAT_PRICES["anthropic/claude-opus-5"]!)
    // 690×$5/M + 40×$25/M = $0.00345 + $0.001 = $0.00445.
    expect(opus).toBeCloseTo(0.00445, 5)
  })
})

/** A valid raw baseline object for the triage question set. */
function validRaw(): Record<string, unknown> {
  return {
    department: "technical",
    frustration: 1,
    business_impact: 2,
    is_urgent: 0.9,
    threatens_churn: 0.1,
    refund_requested: 0,
    is_repeat_contact: 0.2,
  }
}

/** Flatten a recorded Jev response into the plain object a chat model would emit. */
function flatten(response: SystemOneResponse): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, answer] of Object.entries(response.answers)) {
    if (answer.type === "choice") out[name] = answer.choice
    else if (answer.type === "score") out[name] = Math.round(answer.score)
    else out[name] = answer.noul
  }
  return out
}
