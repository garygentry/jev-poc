import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type {
  AnswerSource,
  JevAnswer,
  JevQuestionSet,
  JevState,
  SystemOneResponse,
} from "@shared/jev.ts"

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
)

type FixtureFile = Record<string, SystemOneResponse>

let cache: Map<string, SystemOneResponse> | null = null
let cacheStamp = ""

/**
 * Load every `fixtures/<demo>.json` into one flat map keyed `demo/entry`.
 *
 * Reloaded whenever a fixture file's size or mtime changes. `tsx watch` only
 * restarts on source changes, so without this a freshly written or re-captured
 * fixture is silently ignored and the demo quietly falls back to the synthetic
 * path — which looks like the fixture is wrong rather than merely stale.
 */
function store(): Map<string, SystemOneResponse> {
  const stamp = stampOf()
  if (cache && stamp === cacheStamp) return cache

  cache = new Map()
  cacheStamp = stamp
  if (!existsSync(FIXTURES_DIR)) return cache

  for (const file of readdirSync(FIXTURES_DIR)) {
    if (!file.endsWith(".json")) continue
    const demo = file.replace(/\.json$/, "")
    const parsed = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, file), "utf8"),
    ) as FixtureFile
    for (const [entry, response] of Object.entries(parsed)) {
      cache.set(`${demo}/${entry}`, response)
    }
  }

  return cache
}

/** Cheap fingerprint of the fixtures directory: name, size and mtime of each. */
function stampOf(): string {
  if (!existsSync(FIXTURES_DIR)) return ""
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const info = statSync(path.join(FIXTURES_DIR, file))
      return `${file}:${info.size}:${info.mtimeMs}`
    })
    .join("|")
}

export interface Replay {
  response: SystemOneResponse
  source: Extract<AnswerSource, "seeded" | "synthetic">
}

/**
 * Produce an answer set without calling the model.
 *
 * Prefers a committed fixture; falls back to a deterministic stand-in for the
 * wide fan-outs, where hand-writing a fixture per row would be absurd. The
 * caller must surface `source` — replayed data is never presented as live.
 *
 * @param fixtureKey Lookup key, `demo/entry`. Missing keys fall through to the
 *   deterministic path rather than failing the request.
 */
export function replay(
  fixtureKey: string | undefined,
  state: JevState,
  questions: JevQuestionSet,
): Replay {
  if (fixtureKey) {
    const hit = store().get(fixtureKey)
    if (hit) return { response: hit, source: "seeded" }
  }
  return { response: synthesize(state, questions), source: "synthetic" }
}

/**
 * Build a response shaped like Jev's from a hash of the input.
 *
 * Stable for a given input so the UI does not flicker between runs, and varied
 * enough across inputs that charts and review queues have something to render.
 * It carries no information about the text it was derived from.
 */
function synthesize(
  state: JevState,
  questions: JevQuestionSet,
): SystemOneResponse {
  const stateText = typeof state === "string" ? state : JSON.stringify(state)
  const answers: Record<string, JevAnswer> = {}

  for (const [name, question] of Object.entries(questions)) {
    const seed = hash(`${name}::${stateText}`)

    if (question.type === "noul") {
      answers[name] = { type: "noul", noul: round(unit(seed)) }
      continue
    }

    const keys =
      question.type === "choice"
        ? Object.keys(question.criteria)
        : question.criteria.map((_, level) => String(level))

    const weights = keys.map((key, index) =>
      // Skew towards one option so distributions look decided rather than
      // uniformly flat, which would make every confidence meter read the same.
      Math.pow(unit(hash(`${name}:${key}:${stateText}`)) + 0.05, 3) *
      (index === seed % keys.length ? 6 : 1),
    )
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const probabilities: Record<string, number> = {}
    keys.forEach((key, index) => {
      probabilities[key] = round((weights[index] as number) / total)
    })

    const top = keys.reduce((best, key) =>
      (probabilities[key] as number) > (probabilities[best] as number)
        ? key
        : best,
    )
    const confidence = round(concentration(Object.values(probabilities)))

    if (question.type === "choice") {
      answers[name] = { type: "choice", choice: top, probabilities, confidence }
    } else {
      const legend: Record<string, string> = {}
      question.criteria.forEach((text, level) => {
        legend[String(level)] = text
      })
      const score = keys.reduce(
        (sum, key) => sum + Number(key) * (probabilities[key] as number),
        0,
      )
      answers[name] = {
        type: "score",
        score: round(score),
        probabilities,
        legend,
        confidence,
      }
    }
  }

  // Roughly four characters per token. Only ever used to fill the shape; the
  // UI labels synthetic usage rather than adding it to real spend.
  const inputTokens = Math.ceil(
    (stateText.length + JSON.stringify(questions).length) / 4,
  )

  return {
    model: "fixture/synthetic",
    answers,
    usage: { input_tokens: inputTokens, output_tokens: 0, cost: 0 },
    provider: "fixture",
  }
}

/**
 * How concentrated a distribution is, on 0–1.
 *
 * Normalised inverse entropy, matching how Jev's own confidence behaves: all
 * the mass on one outcome reads 1, a flat distribution reads 0.
 */
function concentration(probabilities: number[]): number {
  if (probabilities.length <= 1) return 1
  const entropy = -probabilities.reduce(
    (sum, p) => (p > 0 ? sum + p * Math.log(p) : sum),
    0,
  )
  return 1 - entropy / Math.log(probabilities.length)
}

/** FNV-1a. Small, fast, and stable across processes — no crypto needed here. */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value
}

const unit = (seed: number) => (seed % 10_000) / 10_000
const round = (value: number) => Math.round(value * 1000) / 1000
