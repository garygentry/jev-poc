import { describe, expect, it } from "vitest"

import { STORMS, templateOf } from "./alerts"
import { cluster, groupIndex, templateGroups, type Edge } from "./policy"

const edge = (a: string, b: string, noul: number | null): Edge => ({ a, b, noul })

describe("cluster", () => {
  const ids = ["a", "b", "c", "d"]

  it("keeps every alert separate when no pair clears the threshold", () => {
    const groups = cluster(ids, [edge("a", "b", 0.2), edge("c", "d", 0.1)])
    expect(groups).toEqual([["a"], ["b"], ["c"], ["d"]])
  })

  it("merges a pair scored at or above the threshold", () => {
    const groups = cluster(ids, [edge("a", "b", 0.9)])
    expect(groups).toContainEqual(["a", "b"])
    expect(groups).toHaveLength(3)
  })

  it("clusters transitively — a~b and b~c pulls in c without an a~c edge", () => {
    const groups = cluster(ids, [edge("a", "b", 0.9), edge("b", "c", 0.8)])
    expect(groups).toContainEqual(["a", "b", "c"])
    expect(groups).toContainEqual(["d"])
  })

  it("treats a missing edge as no merge", () => {
    const groups = cluster(ids, [edge("a", "b", null)])
    expect(groups).toEqual([["a"], ["b"], ["c"], ["d"]])
  })

  it("preserves input order within and across clusters", () => {
    const groups = cluster(ids, [edge("a", "c", 0.9)])
    expect(groups[0]).toEqual(["a", "c"])
  })
})

describe("templateOf", () => {
  const storm = STORMS.find((s) => s.id === "db-pool")!
  const textOf = (id: string) => storm.alerts.find((a) => a.id === id)!.text

  it("gives two same-shape latency alerts the same template", () => {
    // Both fire HighLatency on a service, so the rule and shape are identical —
    // which is exactly why a template rule over-groups them.
    expect(templateOf(textOf("checkout-latency"))).toBe(
      templateOf(textOf("search-latency")),
    )
  })

  it("gives one incident's unlike alerts different templates", () => {
    expect(templateOf(textOf("checkout-latency"))).not.toBe(
      templateOf(textOf("db-pool")),
    )
  })
})

describe("templateGroups over the db-pool storm", () => {
  const storm = STORMS.find((s) => s.id === "db-pool")!

  it("over-groups the two unrelated latency alerts", () => {
    const groups = templateGroups(storm.alerts)
    const index = groupIndex(groups)
    // The template rule puts checkout and search in one group — a false merge.
    expect(index.get("checkout-latency")).toBe(index.get("search-latency"))
  })

  it("splits the one database incident across groups", () => {
    const groups = templateGroups(storm.alerts)
    const index = groupIndex(groups)
    // The three faces of the real incident do not share a template.
    expect(index.get("checkout-latency")).not.toBe(index.get("db-pool"))
    expect(index.get("db-pool")).not.toBe(index.get("orders-503"))
  })
})
