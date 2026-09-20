import { describe, expect, it } from "vitest"

import { FUNCTIONS, REGEX, regexMatches } from "./corpus"
import { MATCH_THRESHOLD, classify, isMatch } from "./policy"

const fnById = (id: string) => FUNCTIONS.find((f) => f.id === id)!

describe("isMatch", () => {
  it("is a hit at or above the threshold and not below", () => {
    expect(isMatch(MATCH_THRESHOLD)).toBe(true)
    expect(isMatch(MATCH_THRESHOLD - 0.01)).toBe(false)
    expect(isMatch(null)).toBe(false)
  })
})

describe("the regex baseline over the corpus", () => {
  it("flags calls that actually set a timeout — the false matches", () => {
    // Both set a timeout, so neither is a real match, yet the regex hits them.
    expect(regexMatches(fnById("fetchOrders"))).toBe(true)
    expect(regexMatches(fnById("postEvent"))).toBe(true)
  })

  it("misses a real match written with a library it does not know", () => {
    expect(regexMatches(fnById("download"))).toBe(false)
    expect(fnById("download").truth).toBe(true)
  })

  it("does catch the plain fetch and axios matches", () => {
    expect(regexMatches(fnById("fetchUser"))).toBe(true)
    expect(regexMatches(fnById("getWeather"))).toBe(true)
    expect(regexMatches(fnById("scrape"))).toBe(true)
  })

  it("does not flag pure or file-I/O functions", () => {
    expect(regexMatches(fnById("sum"))).toBe(false)
    expect(regexMatches(fnById("loadConfig"))).toBe(false)
  })
})

describe("classify", () => {
  it("names a false match: regex hits, the gate does not", () => {
    // fetchOrders sets a timeout, so a well-calibrated gate says no.
    const c = classify(fnById("fetchOrders"), 0.05)
    expect(c.regex).toBe(true)
    expect(c.jev).toBe(false)
    expect(c.disagreement).toBe("false-match")
  })

  it("names a miss: the gate hits, regex does not", () => {
    const c = classify(fnById("download"), 0.95)
    expect(c.jev).toBe(true)
    expect(c.regex).toBe(false)
    expect(c.disagreement).toBe("miss")
  })

  it("reports agreement as null", () => {
    expect(classify(fnById("fetchUser"), 0.95).disagreement).toBeNull()
    expect(classify(fnById("sum"), 0.02).disagreement).toBeNull()
  })

  it("uses a real regex, not a stub", () => {
    expect(REGEX).toBeInstanceOf(RegExp)
  })
})
