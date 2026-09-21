/**
 * Assemble the evidence bundle a Jev-vs-baseline assessment is allowed to read.
 *
 *     pnpm evidence
 *
 * Offline and free: it reads the two committed fixture sets — `fixtures/<slug>.json`
 * (Jev) and `fixtures/baseline/<slug>.json` (the chat model, from
 * `pnpm capture:baseline`) — and reduces them to measured signals with the pure
 * functions in `shared/assessment.ts`. No key, no network, no model. The output
 * is `docs/assessment/evidence.json` (authoritative) and a short human-readable
 * `evidence-summary.md` beside it, so a report is always traceable to the numbers
 * it rests on.
 *
 * What it deliberately does not produce: any notion of "correct". These fixtures
 * have no ground truth, so the bundle carries cost, tokens, decisiveness,
 * agreement and parse-reliability, and says so.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadManifests } from "../src/demos/_kit/load-manifests.ts"

import { aggregate, rollup, summariseDemo } from "../shared/assessment.ts"
import type { DemoEvidence, DemoInput, EvidencePair, Rollup } from "../shared/assessment.ts"
import type { SystemOneResponse } from "../shared/jev.ts"

import type { BaselineEntry } from "./capture-baseline.ts"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(HERE, "../fixtures")
const BASELINE_DIR = path.join(FIXTURES, "baseline")
const OUT_DIR = path.resolve(HERE, "../docs/assessment")

interface EvidenceBundle {
  generatedAt: string
  jevModel: string | null
  baselineModel: string | null
  baselineBackend: string | null
  demoCount: number
  demosMissingBaseline: string[]
  groundTruth: { available: false; note: string }
  notes: string[]
  totals: Rollup
  byShape: Rollup[]
  byGroup: Rollup[]
  demos: DemoEvidence[]
}

const readJson = <T>(file: string): T | null =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null

/** Turn one demo's two fixture files into the aligned pairs the summariser wants. */
function pairsFor(
  jev: Record<string, SystemOneResponse>,
  baseline: Record<string, BaselineEntry> | null,
): EvidencePair[] {
  // The Jev fixture is the spine: it defines which calls were recorded. A key
  // with no baseline is a pair whose baseline side is simply absent.
  return Object.entries(jev).map(([key, entry]) => {
    const b = baseline?.[key]
    return {
      key,
      jev: { answers: entry.answers, usage: entry.usage },
      baseline: b
        ? { answers: b.answers, usage: b.usage, parseOk: b.parseOk }
        : null,
    }
  })
}

const pct = (rate: number | null): string => (rate === null ? "—" : `${(rate * 100).toFixed(0)}%`)
const usd = (n: number | null): string => (n === null ? "—" : `$${n.toFixed(6)}`)
const mult = (n: number | null): string => (n === null ? "—" : `${n.toFixed(1)}×`)

/** A compact table beside the JSON, for a human auditing what the judge is fed. */
function summaryMarkdown(bundle: EvidenceBundle): string {
  const demoRows = bundle.demos
    .map(
      (d) =>
        `| ${d.slug} | ${d.kind} | ${usd(d.cost.jevCostPerCall)} | ${usd(d.cost.baselineCostPerCall)} | ${mult(d.cost.costRatio)} | ${pct(d.agreement.agreementRate)} | ${pct(d.decisiveness.undecidedShare)} | ${pct(d.parse.parseOkRate)} |`,
    )
    .join("\n")

  const shapeRows = bundle.byShape
    .map(
      (r) =>
        `| ${r.key} | ${r.demos} | ${mult(r.costRatio)} | ${pct(r.agreementRate)} | ${r.meanConfidence === null ? "—" : r.meanConfidence.toFixed(2)} | ${pct(r.parseOkRate)} |`,
    )
    .join("\n")

  return [
    `# Evidence summary`,
    ``,
    `**Generated:** ${bundle.generatedAt} · **Jev:** ${bundle.jevModel ?? "—"} · **Baseline:** ${bundle.baselineModel ?? "—"} (${bundle.baselineBackend ?? "—"})`,
    ``,
    `Measured signals only — no ground truth, so no accuracy. Authoritative data is \`evidence.json\`; this table is for eyeballing it.`,
    ``,
    `## Per demo`,
    ``,
    `| demo | shape | Jev $/call | base $/call | ratio | agree | Jev undecided | base parsed |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`,
    demoRows,
    ``,
    `## By shape`,
    ``,
    `| shape | demos | cost ratio | agree | Jev mean confidence | base parsed |`,
    `| --- | --- | --- | --- | --- | --- |`,
    shapeRows,
    ``,
    bundle.demosMissingBaseline.length
      ? `> No baseline captured for: ${bundle.demosMissingBaseline.join(", ")}. Run \`pnpm capture:baseline\` first.`
      : ``,
    ``,
  ].join("\n")
}

async function main(): Promise<number> {
  const { manifests } = await loadManifests()
  const recordable = manifests.filter((m) => m.recorded !== false && m.kind !== "offline")

  const demos: DemoEvidence[] = []
  const demosMissingBaseline: string[] = []
  let jevModel: string | null = null
  let baselineModel: string | null = null
  let baselineBackend: string | null = null

  for (const manifest of recordable) {
    const jev = readJson<Record<string, SystemOneResponse>>(path.join(FIXTURES, `${manifest.slug}.json`))
    if (!jev || Object.keys(jev).length === 0) continue

    const baseline = readJson<Record<string, BaselineEntry>>(path.join(BASELINE_DIR, `${manifest.slug}.json`))
    if (!baseline) demosMissingBaseline.push(manifest.slug)

    jevModel ??= Object.values(jev)[0]?.model ?? null
    if (baseline) {
      const first = Object.values(baseline)[0]
      baselineModel ??= first?.model ?? null
      baselineBackend ??= first?.backend ?? null
    }

    const input: DemoInput = {
      slug: manifest.slug,
      title: manifest.title,
      kind: manifest.kind,
      group: manifest.group,
      questions: manifest.questions,
      pairs: pairsFor(jev, baseline),
    }
    demos.push(summariseDemo(input))
  }

  const bundle: EvidenceBundle = {
    generatedAt: new Date().toISOString(),
    jevModel,
    baselineModel,
    baselineBackend,
    demoCount: demos.length,
    demosMissingBaseline,
    groundTruth: {
      available: false,
      note:
        "No committed ground truth. Agreement is not correctness; decisiveness, cost, " +
        "tokens and parse-reliability are structural facts, not accuracy. Do not rank models by 'right'.",
    },
    notes: [
      "Jev output tokens are free; a chat baseline's output tokens are its expensive half.",
      "The baseline emits a single value per question with no probabilities or confidence, by design.",
      "Only demos with a committed Jev fixture are included (the offline demo and synthetic wide fan-outs are excluded).",
      ...(baselineBackend === "cli"
        ? [
            "Baseline captured via the `claude` CLI: its cost and token counts include the CLI " +
              "turn's own overhead, so they are NOT a bare per-call API cost and must not be " +
              "compared to Jev's. Use the openrouter backend for any cost claim; from a CLI run, " +
              "read agreement, decisiveness and parse-reliability, not cost.",
          ]
        : []),
    ],
    totals: aggregate("all", demos),
    byShape: rollup(demos, (d) => d.kind),
    byGroup: rollup(demos, (d) => d.group),
    demos,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(path.join(OUT_DIR, "evidence.json"), JSON.stringify(bundle, null, 2) + "\n")
  writeFileSync(path.join(OUT_DIR, "evidence-summary.md"), summaryMarkdown(bundle))

  console.log(
    `Evidence written for ${demos.length} demos → docs/assessment/evidence.json` +
      (demosMissingBaseline.length ? `\n  (no baseline yet for: ${demosMissingBaseline.join(", ")})` : ""),
  )
  return 0
}

main().then((code) => process.exit(code))
