import { describe, expect, it } from "vitest"

import { flatJobs, walkRounds } from "./plan"
import type { AnyDemoManifest } from "./types"

import type { JevQuestionSet } from "@shared/jev.ts"

const questions: JevQuestionSet = { q: { type: "noul", instructions: "" } }

/** The fields every manifest shares, filled with harmless placeholders. */
const base = {
  title: "",
  tagline: "",
  thesis: "",
  group: "foundations" as const,
  order: 0,
  shape: { questions: "", states: "", requests: "" },
  primitives: [],
  questions,
  estimateCalls: () => 1,
}

describe("flatJobs", () => {
  it("emits one job per example for a single demo", () => {
    const manifest = {
      ...base,
      kind: "single",
      slug: "single",
      examples: [
        { id: "x", label: "", input: { v: 1 } },
        { id: "y", label: "", input: { v: 2 } },
      ],
      stateFor: (input: { v: number }) => ({ n: input.v }),
    } as unknown as AnyDemoManifest

    const jobs = flatJobs(manifest)
    expect(jobs.map((j) => j.key)).toEqual(["x", "y"])
    expect(jobs[0]!.state).toEqual({ n: 1 })
    expect(jobs[0]!.questions).toBe(questions)
  })

  it("emits one job per item, keyed example/item, for a fan-out", () => {
    const manifest = {
      ...base,
      kind: "fanout",
      slug: "fan",
      examples: [{ id: "ex", label: "", input: {} }],
      itemsFor: () => [
        { id: "0", state: "a" },
        { id: "1", state: "b" },
      ],
    } as unknown as AnyDemoManifest

    expect(flatJobs(manifest).map((j) => j.key)).toEqual(["ex/0", "ex/1"])
  })

  it("returns nothing for rounds and offline (they are not flat lists)", () => {
    const offline = { ...base, kind: "offline", slug: "off", examples: [] } as unknown as AnyDemoManifest
    const rounds = { ...base, kind: "rounds", slug: "r", examples: [] } as unknown as AnyDemoManifest
    expect(flatJobs(offline)).toEqual([])
    expect(flatJobs(rounds)).toEqual([])
  })
})

describe("walkRounds", () => {
  it("descends the manifest's own plan, keyed by depth, advancing on the returned answers", async () => {
    const advanced: number[] = []
    const manifest = {
      ...base,
      kind: "rounds",
      slug: "walk",
      examples: [{ id: "case", label: "", input: {} }],
      stateFor: () => ({ fixed: true }),
      walk: {
        initial: 0,
        plan: (depth: number, carry: number) =>
          depth < 2 ? { questions, round: { depth, carry } } : null,
        advance: (_round: unknown, _answers: unknown, carry: number) => {
          advanced.push(carry)
          return carry + 1
        },
        maxDepth: 5,
      },
    } as unknown as AnyDemoManifest

    const visited: string[] = []
    await walkRounds(manifest as never, async ({ key, state }) => {
      visited.push(key)
      expect(state).toEqual({ fixed: true })
      return {}
    })

    expect(visited).toEqual(["case-d0", "case-d1"])
    expect(advanced).toEqual([0, 1]) // carry threaded through advance each round
  })
})
