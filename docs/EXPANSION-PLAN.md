# Expansion plan — a demo kit, and twelve more use cases

**Status:** not started. Written 2026-09-19 to be executed in a fresh session.
**Prerequisite:** none. This document is self-contained.

---

## 1. What this repo is, for a session that has not seen it

`jev-poc` is a working tour of **Jev**, TypeSafe's first *System One* model, served
through OpenRouter. Jev does not generate text. You POST `state` plus a map of
named `questions` and get back typed answers with calibrated probabilities:

```
POST https://openrouter.ai/api/alpha/decisions       (NOT /chat/completions)
{"model": "typesafe/jev-1.13", "state": {...}, "questions": {...}}

{"answers": {"department": {"type":"choice","choice":"technical",
                            "probabilities":{...},"confidence":1}},
 "usage": {"input_tokens":538,"output_tokens":80,"cost":0.000022596}}
```

- **Primitives:** `choice` (one of N + distribution + confidence), `score`
  (position on a 0-indexed rubric, returns a weighted mean that can land
  *between* levels), `noul` (probability 0–1, no separate confidence).
- **Price:** $0.042/M input, **output free**. 32k context. ~250–500ms measured.
- **Cannot:** generate text, count, do arithmetic, compare numbers, handle
  dates, read images. Do not design a question that needs any of these.
- **Key fact that shapes everything:** questions batch into one request *only
  when they share a state*. Many questions over one state is one request; one
  question over many states must fan out.

Eight demos exist (`triage`, `guardrail`, `rerank`, `typewriter`, `taxonomy`,
`router`, `bulk`, `personas`). Read `README.md` first, then `shared/jev.ts`.

### Things already learned the hard way — do not rediscover these

1. **Jev is extremely decisive.** Clear cases return probability `1.0` and
   confidence `1.0`. Thresholds tuned against invented fixtures do not
   transfer. `UNDECIDED_FLOOR` is `0.15` for this reason, not `0.05`.
2. **A weak answer usually means a weak question.** The router's
   `is_ambiguous` read above 0.6 on four of five prompts until the question
   distinguished *unclear goal* from *material that lives elsewhere*. Then it
   read 0.04. Blame the question before the model.
3. **Jev applies your criteria literally.** `cat .env` came back
   `catastrophic` because that option's text said "or exposes credentials".
4. **Always offer a no-match option** on a `choice`. It cannot pick a value
   you never gave it.
5. **`confidence ≈ 0` is a flat distribution, not a low score.** It must render
   as its own state and must not be acted on.
6. **Score levels are 0-indexed**, and `legend`/`probabilities` arrive
   string-keyed.
7. The decisions endpoint is on an **alpha path**; `JEV_DECISIONS_URL` in
   `.env` overrides it.

### Commands

```sh
pnpm dev         # client :5180, Hono sidecar :8787 (key never leaves the sidecar)
pnpm test        # vitest, pure policy logic, offline
pnpm e2e         # playwright, own server on :5181/:8788, key blanked, fixtures only
pnpm capture     # re-record fixtures from live Jev (needs a key in .env)
pnpm typecheck && pnpm build
```

---

## 2. Goal of this plan

Two things, in order:

1. **Build a demo kit** so a new demo is ~80 lines of its own substance and
   *zero* edits to any central file. Adding demos is currently too expensive to
   do a dozen more times.
2. **Add 12 demos** that show Jev displacing traditional work — a
   frontier-model call, a human in a queue, or a regex nobody can write — with
   a cost and latency story that is measured where it can be and labelled as an
   assumption where it cannot.

The organising idea stays: **each demo is a structural shape, not a topic.**
The existing eight cover four shapes. The twelve below add six more.

---

## 3. Part one — the demo kit

### 3.1 The friction being removed

Measured on the current eight:

| Problem | Evidence |
|---|---|
| Three central files edited per demo | `registry.ts` (122), `scripts/capture.ts` (230), `e2e/demos.spec.ts` (455) |
| The same scaffold in every demo | 11 identical structural elements in each of triage/guardrail/router `Demo.tsx` |
| Fixture keys built as raw strings | 5 construction sites across `Demo.tsx` and `capture.ts` — already caused one silent fallback-to-synthetic bug |
| Per-demo `Demo.tsx` | 145–434 lines, most of it repeated |

At 20 demos those numbers become unmanageable. Fix before adding.

### 3.2 The critical design constraint

**The manifest must be JSX-free.** `scripts/capture.ts` and the Playwright
config both run under Node and must import every demo's metadata without
pulling in React. So:

```
src/demos/<slug>/
  demo.ts          manifest + questions + examples   ← JSX-free, Node-importable
  policy.ts        pure: answers → verdict + trace
  policy.test.ts   vitest
  Demo.tsx         imports the manifest; only the bespoke visualisation
```

`Demo.tsx` imports `demo.ts`. Never the reverse.

### 3.3 `src/demos/_kit/types.ts`

```ts
export type DemoKind =
  | "single"    // one state, N questions, one request
  | "fanout"    // N states, shared questions, capped concurrency
  | "pairwise"  // blocked N×N comparisons
  | "rounds"    // sequential; each round's questions depend on the last answers
  | "windowed"  // sliding window over one long input, then aggregate
  | "cascade"   // a Jev gate, then optionally an expensive model
  | "offline"   // no calls; operates on already-recorded answers

export type DemoGroup =
  | "control-plane" | "cost" | "engineering"
  | "safety" | "documents" | "method"

/** What this demo displaces, and what that costs today. */
export interface Displacement {
  baseline: string                        // "one Haiku 4.5 call per item"
  unit: "item" | "request" | "human-minute"
  baselineUsd: number                     // per unit
  source: string                          // where the number came from + date
}

export interface DemoManifest<TInput = unknown> {
  slug: string
  title: string
  tagline: string
  thesis: string
  group: DemoGroup
  kind: DemoKind
  shape: { questions: string; states: string; requests: string }
  primitives: Array<"choice" | "score" | "noul">
  displaces?: Displacement
  questions: JevQuestionSet
  examples: Array<{ id: string; label: string; input: TInput }>
  stateFor: (input: TInput) => JevState
  /** Upstream calls one run costs. Powers the cost guard and capture budget. */
  estimateCalls: (input: TInput) => number
}
```

### 3.4 Registry by discovery, not enumeration

```ts
// src/demos/registry.ts  — browser
const manifests = import.meta.glob("./*/demo.ts", { eager: true, import: "manifest" })
const components = import.meta.glob("./*/Demo.tsx")          // lazy
```

```ts
// src/demos/_kit/load-manifests.ts  — Node, for capture + e2e
// readdirSync("src/demos") → await import(`../${slug}/demo.ts`)
```

Adding a demo means creating a directory. Nothing central changes.
`registry.ts` keeps only the display **order** of groups.

### 3.5 One place that builds fixture keys

```ts
// src/demos/_kit/fixtures.ts
export const fixtureKey = (slug: string, exampleId: string, part?: string) =>
  part ? `${slug}/${exampleId}/${part}` : `${slug}/${exampleId}`
```

Used by every runner and by `capture.ts`. Delete the five hand-built strings.

### 3.6 Runners — `src/demos/_kit/runners/`

One hook per `DemoKind`, each returning the same envelope
(`{ data, error, loading, usage, latencyMs, source, wire, run }`) so
`DemoScaffold` does not care which it is:

- `useSingleRun` — wraps the existing `useJev`
- `useFanOut` — `/api/jev/batch`, server-capped
- `usePairwise` — builds the blocked pair list, then `useFanOut`
- `useRounds` — generalises the taxonomy loop (round *n* questions from round *n−1* answers)
- `useWindowed` — chunks one long input, fans out, aggregates
- `useCascade` — Jev gate, then optionally a chat model via `/api/chat` (new route, §3.9)
- `useOffline` — reads recorded answers, no calls

Migrate the eight existing demos onto these. `taxonomy` becomes the reference
`rounds` demo; `rerank`/`personas`/`bulk` become `fanout`.

### 3.7 `DemoScaffold`

Owns everything currently repeated: `DemoFrame`, `RunBar`, example chips,
`ErrorNote`, the two-column grid, the `AnswerCard` list, `PolicyTrace`,
`WirePanel`, and the source badges. A demo supplies only its own view:

```tsx
export default function Demo() {
  const run = useSingleRun(manifest)
  return (
    <DemoScaffold manifest={manifest} run={run} policy={decide}>
      {({ answers, verdict }) => <RiskMatrix answers={answers} verdict={verdict} />}
    </DemoScaffold>
  )
}
```

Target: a `single` demo's `Demo.tsx` drops from ~145 lines to ~30.

### 3.8 `<Displacement>` — the cost story, told the same way every time

This is what makes the twelve demos add up to an argument rather than a list.
It renders three rows and never conflates them:

| Row | Where it comes from |
|---|---|
| **This run** | `usage.cost`, `wallClockMs`, call count — **measured** |
| **The same work today** | `manifest.displaces` — **a stated assumption**, with its source and date |
| **Ratio** | Arithmetic over the two, labelled as resting on the assumption |

Rules, carried from the existing honesty constraints:
- Nothing renders here unless `source === "live"`.
- The baseline row always shows its `source` string inline.
- Never print "10x cheaper" without the assumption visible in the same card.

### 3.9 The baseline harness — measured comparison as a kit feature

**Decision taken:** build this once, in the kit, so *most* demos get a measured
head-to-head rather than a projected one. This is what choosing twelve demos
over twenty buys.

**New route `POST /api/chat`** — a thin proxy to OpenRouter
`/chat/completions`. Same key, same sidecar, same spend meter. Hard-capped
`max_tokens`, model restricted to an allowlist, and every demo that uses it
shows a "this spends real money on a second model" badge before running.

**Baseline model: `anthropic/claude-haiku-4.5`.** Verified on OpenRouter
2026-09-19: **$1.00/M input, $5.00/M output**, 200k context, native
`json_schema` structured output. Chosen as the cheapest model anyone would
actually trust for this tier of work — the comparison should be against a
credible baseline, not a weak one that flatters Jev. Sonnet 5 ($2/$10) and
Opus 5 ($5/$25) are shown as *projected* alternatives in the same card, since
plenty of teams do send classification to a frontier model.

**`runBaseline(manifest, input)`** asks the chat model for the same structured
answer via `json_schema`, derived automatically from the demo's
`JevQuestionSet` — a `choice` becomes an enum, a `score` an integer, a `noul` a
0–1 number. One implementation serves every demo that opts in.

`<Displacement>` then renders **measured against measured**:

| | measured |
|---|---|
| Jev | cost, latency, typed answer |
| Haiku 4.5 | cost, latency, parsed answer |
| Agreement | where the two differ, shown as data — not scored |

**One real data point, gathered while writing this plan.** Same triage ticket,
same seven fields:

| | Jev | Haiku 4.5 |
|---|---|---|
| Cost | $0.000029 | $0.000792 |
| Latency | 461ms | 6084ms |
| `frustration` | 1.01 (annoyed) | 2 (angry) |
| `threatens_churn` | 0.07 | 0.80 |

27× cheaper and 13× faster on this one ticket. Caveats that must travel with
this number wherever it appears: **it is a single example, not a benchmark**;
the two prompts are not token-identical (517 vs 690 input tokens, because a
question set is more verbose than a hand-written prompt); and both latencies
include TLS setup from this machine.

The disagreement is the more interesting half and is why the harness is worth
building. The ticket is frustrated but civil and never mentions leaving, so the
two models differ sharply on `threatens_churn` — and Haiku's `0.80` is a
*generated token*, not a distribution, with no calibration behind it. Demos
should show the disagreement and let the reader judge; **do not ship a UI that
scores one model as correct**, because there is no ground truth in these
fixtures.

### 3.10 Cost guard

`estimateCalls()` feeds:
- the UI: projected calls + projected USD shown **before** any fan-out runs;
- `pnpm capture`: prints a total projected cost and requires `--yes` above $0.25.

### 3.11 Tests after the refactor

- `e2e/contract.spec.ts` — loops the registry and asserts the properties every
  demo must have: renders, asks, shows a wire panel, badges its source, never
  fires a fan-out on render, respects the server cap, degrades on a 502. One
  file covers all twenty.
- `e2e/demos/<slug>.spec.ts` — only the claim specific to that demo.
- Delete the monolithic `e2e/demos.spec.ts`, distributing its assertions.

### 3.12 `/method` page

At 20 demos the gallery needs a spine. One page explaining: the three
primitives and how to pick one; the shapes and why a request carries one state;
how to set a threshold (linking the `threshold-fitter` demo); and the honesty
rules this repo holds itself to. Link it from the header.

### 3.13 Definition of done for part one

- [ ] A new demo requires creating one directory and editing nothing else.
- [ ] The eight existing demos are migrated, and their e2e specs still pass.
- [ ] `Demo.tsx` for `triage` is under 40 lines.
- [ ] `pnpm capture` derives its plan from the manifests.
- [ ] `pnpm test`, `pnpm e2e`, `pnpm typecheck`, `pnpm build` all green.
- [ ] One commit for the kit, one for the migration — reviewable separately.

---

## 4. Part two — twelve use cases

**Decision taken: twelve, not twenty.** The twelve are chosen so that **eight
of them carry a measured head-to-head against Haiku 4.5**, which a wider set
could not have afforded in attention. Each names what it displaces. New shapes
are marked ★; a measured baseline is marked **M**.

| # | Demo | Kind | M | Displaces | The claim |
|---|---|---|:-:|---|---|
| **Agent control plane** |
| 9 | Cascade router | ★ cascade | **M** | Sending every request to the best model | Jev gates, Haiku answers the easy ones, Opus the rest — **every figure measured** |
| 10 | Context pruner | fanout | **M** | Truncating blindly, or paying a big model to summarise | One noul per chunk; the saving is the tokens never sent |
| 11 | Done-check | single, matrix | **M** | Trusting an agent's own "done", or a human verifying | One noul per acceptance criterion, against evidence |
| 12 | Loop detector | ★ windowed | — | Max-iteration counters that cut good runs short and let bad ones burn | Reads "no progress" off the trace instead of counting |
| **Engineering workflow** |
| 13 | PR risk triage | single | **M** | Reviewing every diff alike, or not at all | Risk dimensions → reviewer → "does a human need to see this" |
| 14 | Flaky vs regression | single | **M** | An engineer reading CI output | Flaky / real / infra, with a confidence gate before auto-retry |
| 15 | Alert dedup | ★ pairwise | — | Dedup rules matching on message templates | "Same incident?" — which a template cannot ask |
| 16 | Semantic grep | fanout | **M** | A regex nobody can write | One noul per function against a rule stated in English |
| **Safety** |
| 17 | Multi-policy moderation | single, matrix | **M** | One large prompt covering every policy at once | 12 policies in **one** request, each with its own threshold |
| **Documents** |
| 18 | Clause risk | fanout, matrix | **M** | A lawyer reading every clause of every contract | N clauses × M risk questions; only the risky ones surface |
| 19 | Long-document sweep | ★ windowed | — | Stuffing a document that does not fit in 32k | Chunk, judge, aggregate — and state what chunking costs |
| **Method** |
| 20 | Threshold fitter | ★ offline | — | Guessing the numbers every other demo hardcodes | Sweeps recorded answers against labels; **zero new calls** |

### Why these twelve

- **Every new shape is present:** cascade★, windowed★ (×2), pairwise★,
  offline★, plus the matrix layout — on top of the single / fanout / rounds
  the existing eight already cover.
- **Categories stay balanced:** replaces-a-frontier-call (9, 10, 17);
  replaces-a-human (11, 13, 18); replaces-a-regex (15, 16);
  newly-affordable (12, 14, 19, 20).
- **#9 is the headline.** Both halves measured, so the cost claim rests on
  nothing but `usage`.
- **#17 carries the per-request economics.** Twelve policies share one state,
  so they cost one request; the baseline needs twelve prompts or one long
  fragile one. This is the clearest demonstration of the batching rule.
- **#20 is the most useful.** Every other demo hardcodes thresholds. This one
  derives them from labelled data, costs nothing to run, and is sequenced last
  so it can retroactively justify the other nineteen.

### Cut from the original twenty, and why

Tool selection and escalation gate (too close to the existing `router` and
`triage` shapes), completion gate (same lesson as the cascade, weaker), RAG
index filter (same judge-then-drop shape as the context pruner, which is more
on-brand), commit↔diff and claim triage (good, but neither adds a shape),
queue prioritiser (a sorted fanout, which `rerank` already shows), and
near-duplicate clustering (pairwise, already covered by alert dedup).

Keep this list. If the twelve land well, these are the obvious next eight.

### Per-demo deliverable

Each demo ships: `demo.ts` (manifest, questions, 4–6 examples), `policy.ts` +
`policy.test.ts` (the decision, with the thresholds *justified in a comment*),
`Demo.tsx` (the bespoke view), captured fixtures, and one
`e2e/demos/<slug>.spec.ts` asserting its specific claim.

**Question-design rule for every new demo:** write the questions, capture, then
*read the distributions before building any UI*. If an answer looks wrong,
assume the question is wrong. Budget one re-capture per demo for this.

---

## 5. Phasing

Ordered so a partial run still ships something coherent.

| Phase | Content | Why here |
|---|---|---|
| **0** | Kit (§3.1–3.7), migrate the eight, green suites | Nothing else is affordable first. Ships no features — that is expected and approved |
| **1** | `<Displacement>`, cost guard, `/api/chat` + `runBaseline` (§3.9), `/method` page | The spine every later claim hangs on. Validate the harness against the existing `triage` fixtures before building on it |
| **2** | **9** cascade router, **10** context pruner | The two strongest cost demos; proves the measured comparison end to end |
| **3** | **11** done-check, **12** loop detector | Control plane; introduces the windowed runner |
| **4** | **13, 14, 15, 16** engineering workflow | Familiar baselines; introduces the pairwise runner |
| **5** | **17** moderation, **18** clause risk, **19** long-doc sweep | Heaviest fan-outs; run once the caps are proven |
| **6** | **20** threshold fitter, then re-tune every earlier demo's gates with it | Needs the other fixtures to exist first |
| **7** | README, `/method` finalisation, full capture, full verification | — |

Phase 6 is deliberately last: it is the demo that improves all the others.
Phase 1 is deliberately early: building eight demos on an unvalidated
comparison harness would mean rebuilding eight demos.

## 6. Budget and verification

**Money.** Capture for twelve demos ≈ 800–1,500 Jev calls ≈ **under $0.10** at
$0.042/M input. The eight baseline demos add Haiku 4.5 calls at a **measured
$0.0008 each** — say 8 demos × 5 examples × 3 runs ≈ 120 calls ≈ **$0.10**.
The cascade demo also calls Opus 5 on its hard inputs: ~15 calls ≈ **$0.15**.

Total **around $0.35**, against a $10 key limit with $0.0086 used to date.
Budget two full re-captures and it is still under $1. The cost guard (§3.10)
prints a projection and requires `--yes` above $0.25, so this cannot run away
unnoticed.

**Watch the baseline spend, not the Jev spend.** Jev is the cheap half by two
orders of magnitude. Every unexpected bill in this project will come from
`/api/chat`.

**Verification per phase.** `pnpm typecheck && pnpm test && pnpm e2e && pnpm build`
green, plus a browser pass on new demos at 375 / 1280 with the console clean.
Screenshots to `./screenshots`.

**Verification of the claims** — the part that matters:
- Every number in a `<Displacement>` card is either measured this run or
  labelled with its source and date.
- Every threshold in a `policy.ts` has a comment saying why it is that number.
- Re-read each captured distribution before trusting the demo built on it.

## 7. Constraints carried forward

These are already load-bearing in this repo. Do not relax them.

- Measured figures are **withheld, not estimated**, when the model did not
  answer. No latency, cost or accuracy without `source === "live"`.
- Replayed answers are badged; seeded and synthetic are badged *differently*.
- Ties are not rankings — report bounds, on both sides of any comparison.
- A flat distribution renders as "cannot tell" and is never acted on.
- Model prices are dated external data and are only ever used to project.
- Fan-outs are capped server-side and never fire on render.
- The API key stays in the sidecar.

Two further rules the baseline harness adds:

- **Never score one model as correct.** These fixtures have no ground truth.
  Show the disagreement; let the reader judge. The one place a "right answer"
  may be asserted is the `rerank` corpus, which has gold labels fixed before
  either ranker ran.
- **Baseline prompts are not token-identical to question sets**, and cannot
  be. Say so in the card rather than implying a controlled experiment.

## 8. Decisions taken

Settled 2026-09-19; no further sign-off needed to begin.

1. **Twelve, not twenty** — chosen so eight carry a *measured* baseline
   instead of one. The cut eight are listed in §4 as the next tranche.
2. **Baseline model: `anthropic/claude-haiku-4.5`** via OpenRouter — the
   cheapest model anyone would actually trust for this work, verified at
   $1.00/M in, $5.00/M out with native `json_schema` support. Sonnet 5 and
   Opus 5 appear as projected alternatives in the same card; the cascade demo
   calls Opus 5 for real on its hard branch.
3. **Refactor first.** Phase 0 rewrites working code and ships no features.
   Approved.

## 9. First three steps in the new session

1. Read `README.md`, then `shared/jev.ts`, then `src/demos/triage/` — the
   smallest complete demo, and the reference for what the kit must preserve.
2. Build `src/demos/_kit/` (§3.3–3.7) and migrate **`triage` only**. Get
   `pnpm test`, `pnpm e2e` and `pnpm typecheck` green on that one demo before
   touching the other seven. `Demo.tsx` under 40 lines is the signal the kit
   is right.
3. Migrate the remaining seven, then commit the kit and the migration
   separately so each is reviewable on its own.
