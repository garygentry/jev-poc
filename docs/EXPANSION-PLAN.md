# Expansion plan — a demo kit, and twenty more use cases

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
   do twenty times.
2. **Add up to 20 demos** that show Jev displacing traditional work — a
   frontier-model call, a human in a queue, or a regex nobody can write — with
   a cost and latency story that is measured where it can be and labelled as an
   assumption where it cannot.

The organising idea stays: **each demo is a structural shape, not a topic.**
The existing eight cover four shapes. The twenty below add six more.

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

At 28 demos those numbers become unmanageable. Fix before adding.

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

This is what makes the twenty demos add up to an argument rather than a list.
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

### 3.9 New server route: `POST /api/chat` (for cascade demos only)

A thin proxy to OpenRouter `/chat/completions` so a cascade demo can *measure*
both halves instead of projecting one. Same key, same sidecar, same spend
meter. Hard-capped `max_tokens`, model restricted to an allowlist
(`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`). Off unless a demo
asks for it, and every such demo shows a "this spends real money on a second
model" badge before running.

### 3.10 Cost guard

`estimateCalls()` feeds:
- the UI: projected calls + projected USD shown **before** any fan-out runs;
- `pnpm capture`: prints a total projected cost and requires `--yes` above $0.25.

### 3.11 Tests after the refactor

- `e2e/contract.spec.ts` — loops the registry and asserts the properties every
  demo must have: renders, asks, shows a wire panel, badges its source, never
  fires a fan-out on render, respects the server cap, degrades on a 502. One
  file covers all 28.
- `e2e/demos/<slug>.spec.ts` — only the claim specific to that demo.
- Delete the monolithic `e2e/demos.spec.ts`, distributing its assertions.

### 3.12 `/method` page

At 28 demos the gallery needs a spine. One page explaining: the three
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

## 4. Part two — twenty use cases

Chosen for **shape diversity** and for a defensible cost story. Each names what
it displaces. New shapes are marked ★.

| # | Demo | Kind | Displaces | The claim |
|---|---|---|---|---|
| **Agent control plane** |
| 9 | Tool selection | single | A frontier call per agent step to pick a tool | Same routing at ~1/200 the cost, inside the step's latency budget |
| 10 | Loop detector | ★ windowed | Max-iteration counters that cut off good runs and permit bad ones | Detects "no progress" from the trace, not from a counter |
| 11 | Done-check | single (matrix) | Trusting the agent's own "done", or a human checking | One noul per acceptance criterion; evidence, not assertion |
| 12 | Context pruner | fanout | Naive truncation, or paying a big model to summarise | Drops irrelevant context before the expensive call — the saving is the pruned tokens |
| 13 | Escalation gate | single | A fixed rule ("3 turns then human") | Escalates on what the conversation shows |
| **Cost cascades** |
| 14 | Cascade router ★ | ★ cascade | Sending everything to the best model | **Both halves measured.** Jev gate + Haiku vs Opus on the same inputs |
| 15 | RAG index filter | fanout | Embedding the whole corpus | Judge each chunk before it is indexed; report tokens not spent |
| 16 | Completion gate | single, debounced | Calling the completion model on every pause | Only call the expensive model when the context deserves it |
| **Engineering workflow** |
| 17 | PR risk triage | single | Reviewing every diff equally, or not at all | Risk dimensions → reviewer routing → "does a human need this" |
| 18 | Flaky vs regression | single | An engineer reading CI output | Flaky / real / infra, with a confidence gate before auto-retry |
| 19 | Alert dedup | ★ pairwise | Dedup rules on message templates | "Same incident?" across open incidents, which templates cannot see |
| 20 | Commit ↔ diff | single | A pre-commit regex for debug code and secrets | Does the message describe the change; what was left behind |
| 21 | Semantic grep | fanout | A regex you cannot write | One noul per function against a rule in English |
| **Content, safety, moderation** |
| 22 | Multi-policy moderation | single (matrix) | One large prompt covering every policy | 12 policies in one request, each with its own threshold |
| 23 | Queue prioritiser | fanout | FIFO moderation queues | Severity-ordered queue; humans see the worst first |
| 24 | Claim triage | fanout | Fact-checking a whole document | Which sentences carry a checkable claim |
| **Documents & data** |
| 25 | Clause risk | fanout (matrix) | A lawyer reading every clause | N clauses × M risk questions; only the risky ones surface |
| 26 | Long-document sweep | ★ windowed | Stuffing a document that does not fit in 32k | Chunk, judge, aggregate — and say what chunking costs |
| 27 | Near-duplicate clustering | ★ pairwise | Fuzzy string matching | Cheap blocking pass, then pairwise "same thing?" |
| **Method** |
| 28 | Threshold fitter | ★ offline | Guessing the numbers every other demo hardcodes | Sweeps recorded answers against labels, plots the trade-off, **zero new calls** |

### Why these twenty

- **Shapes:** adds windowed, pairwise, cascade, offline, and the matrix
  layout to the existing single / fanout / rounds.
- **Categories:** replaces-a-frontier-call (9, 12, 14, 15, 16, 22);
  replaces-a-human (11, 17, 23, 25); replaces-a-regex (19, 20, 21, 27);
  newly-affordable (10, 13, 18, 24, 26, 28).
- **#28 is the most useful one.** Every other demo hardcodes thresholds. This
  one shows how to derive them from labelled data, costs nothing to run, and
  retroactively justifies the numbers in the other 27.
- **#14 is the headline** for the stated goal, because both sides are measured
  rather than one side being projected.

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
| **0** | Kit (§3.1–3.7), migrate the eight, green suites | Nothing else is affordable first |
| **1** | `<Displacement>`, cost guard, `/api/chat`, `/method` page | The spine the cost story hangs on |
| **2** | **14** cascade router, **12** context pruner, **15** RAG filter | The strongest cost demos; validates `<Displacement>` early |
| **3** | **9, 10, 11, 13** control plane | Most on-brand; all reuse phase-0 runners |
| **4** | **17–21** engineering workflow | Familiar baselines, easy to judge |
| **5** | **22, 23, 24** safety · **25, 26, 27** documents | Heaviest fan-outs; do once caps are proven |
| **6** | **28** threshold fitter, then re-tune every earlier demo's gates with it | Needs the others' fixtures to exist |
| **7** | README, `/method` finalisation, full capture, full verification | — |

Phase 6 is deliberately last: it is the demo that improves all the others.

## 6. Budget and verification

**Money.** Capture for 20 demos ≈ 1,500–3,000 Jev calls ≈ **under $0.15** at
$0.042/M input. The cascade demo additionally calls Haiku/Sonnet/Opus for real:
~30 calls ≈ **$0.10–0.20**. Total **well under $1**, against a $10 key limit.
Re-captures are cheap; budget two full ones.

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

## 8. Decisions worth confirming before starting

1. **Twenty, or a sharper twelve?** Twenty covers more ground; twelve would
   allow a measured baseline on several demos rather than one.
2. **`/api/chat` for real measured cascades** — spends real money on Claude
   models. Worth it for #14; optional elsewhere.
3. **Phase 0 is a refactor of working code.** It touches all eight demos and
   ships no new features. Confirm that is acceptable before it starts.
