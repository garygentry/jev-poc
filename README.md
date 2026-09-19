# Jev POC

A working tour of **Jev**, TypeSafe's first *System One* model, in eight demos.

Jev does not generate text. You send it `state` plus a map of named `questions`,
and it returns typed answers with calibrated probabilities. There is no prose to
parse and no free-text-to-struct failure mode, because the output is constrained
to the options you supplied — so the interesting work moves out of prompt
engineering and into ordinary code.

```jsonc
// POST https://openrouter.ai/api/alpha/decisions
{
  "model": "typesafe/jev-1.13",
  "state": { "ticket": "Stripe payouts have been failing for three days." },
  "questions": {
    "department":  { "type": "choice", "instructions": "Which team should handle this.",
                     "criteria": { "billing": "…", "technical": "…", "other": "None of the above." } },
    "impact":      { "type": "score",  "instructions": "How much harm right now.",
                     "criteria": ["No harm.", "Inconvenience.", "Active revenue loss."] },
    "is_urgent":   { "type": "noul",   "instructions": "The message conveys urgency." }
  }
}
```

```jsonc
{
  "answers": {
    "department": { "type": "choice", "choice": "technical",
                    "probabilities": { "technical": 0.907, "billing": 0.071, "other": 0.022 },
                    "confidence": 0.88 },
    "impact":     { "type": "score",  "score": 1.83, "confidence": 0.79, "probabilities": { … } },
    "is_urgent":  { "type": "noul",   "noul": 0.96 }
  },
  "usage": { "input_tokens": 471, "output_tokens": 84, "cost": 0.000019782 }
}
```

## Quickstart

```sh
pnpm install
cp .env.example .env     # optional — paste an OpenRouter key to go live
pnpm dev                 # client on :5180, sidecar on :8787
```

It works with **no key**: every demo replays a committed fixture and badges
itself as doing so. To go live, put an
[OpenRouter key](https://openrouter.ai/settings/keys) in `.env` and restart.

```sh
pnpm test        # 67 offline tests — no key, no network
pnpm typecheck
pnpm capture     # re-record the fixtures against live Jev (needs a key)
pnpm build
```

## The three primitives

| | Answers | Returns |
|---|---|---|
| **Choice** | Which one of these? | The winner, the full distribution, and a confidence |
| **Score** | Where on this rubric? | A probability-weighted mean that can land *between* levels, plus a confidence |
| **Noul** | Does this hold? | A probability 0–1. No separate confidence — the probability *is* the answer |

Pick by what the answer **means**, not by taste. One of a fixed set is a Choice;
a degree along a described dimension is a Score; whether a condition holds is a
Noul. They are not three flavours of classifier.

## The eight demos

Each is a different **shape**, not a different topic. This is the organising
idea: questions batch into one request *only when they share state*.

| # | Demo | questions · states · requests | Shows |
|---|---|---|---|
| 1 | Ticket triage | 7 · 1 · 1 | Decomposition; policy in code; thresholds scaled to stakes |
| 2 | Command guardrail | 6 · 1 · 1 | An agent permission gate, and why severity ordering matters |
| 3 | Semantic re-rank | 1 · 24 · 24 concurrent | Fan-out; probability as a sort key; *ties are not rankings* |
| 4 | Live typewriter | 12 · 1 · 1 per pause | What ~100ms buys: twelve meters repainting as you type |
| 5 | Taxonomy beam search | 1 per live branch · 1 · 1 per level | Reading the **distribution**; confidence deciding depth |
| 6 | Model router | 6 · 1 · 1 | The agent control plane; router cost vs routed cost |
| 7 | Bulk labelling | 4 · up to 200 · 8 at a time | Free output tokens; confidence as a human-review queue |
| 8 | Persona panel | 2 · 12 · 12 concurrent | Probability across a *population*, where the mean lies |

Demo 3 and demo 1 are deliberate mirror images. Seven questions about one ticket
cost roughly one question's wall-clock, because they share a state. Twenty-four
passages cannot share one, so they fan out instead.

## Architecture

```
shared/jev.ts        the wire contract, used verbatim by both sides
server/              Hono sidecar on :8787 — the API key never leaves it
  transport.ts       bounded retries, timeouts, strict response validation
  routes.ts          /api/health · /api/jev/decide · /api/jev/batch
  fixtures.ts        replay when no key is set
src/
  components/jev/    the instrument primitives every demo is built from
  demos/<slug>/      questions.ts · policy.ts · policy.test.ts · examples.ts · Demo.tsx
fixtures/            per-demo recorded responses
scripts/capture.ts   re-record them from live Jev
```

**Policy lives in code, not in the model.** Every demo's thresholds and
branching are plain TypeScript that you can read, unit-test and retune without
re-running inference — and each demo renders its own policy source beside the
verdict, with the branches that fired highlighted. That is why the test suite
runs offline: model quality is measured against your data, policy correctness by
tests that finish in milliseconds.

**Fan-out is capped server-side**: 8 concurrent, 200 rows, clamped in
`server/config.ts` rather than trusted from the browser. A running token and
dollar meter sits in the header, fed only by real `usage` blocks.

## Notes that cost something to learn

- Jev is a **decisions model**. `POST /chat/completions` rejects it outright —
  the error message is what reveals `/api/alpha/decisions`, and it is not in
  OpenRouter's docs. That path is still `alpha`; `JEV_DECISIONS_URL` in `.env`
  overrides it without a code change.
- Jev does not appear in the default `/api/v1/models` listing. Its modality is
  `text->decisions` and `supported_parameters` is empty. Query
  `/api/v1/models/typesafe/jev-1.13/endpoints` directly.
- **Score levels are 0-indexed.** Three criteria means levels 0/1/2, so 1.5 sits
  between middle and top.
- Score `legend` and `probabilities` arrive **string-keyed** even though the
  levels are integers.
- **`confidence: 0` is not a low score — it is a flat distribution**, meaning Jev
  cannot tell. It must not be acted on, and every component here renders it as
  its own state rather than as a short bar.
- Always give a Choice a **no-match option**. The model cannot pick a value you
  never offered it, so without one it must choose among wrong answers.
- Jev cannot count, do arithmetic, compare numbers, handle dates, read images, or
  write anything. No demo here asks it to.

## What is honest about the numbers

This repo is a demonstration, and a few of its claims are easy to overstate, so:

- **The committed fixtures are hand-written**, not recordings. They are
  plausible and correctly shaped, but no model produced them. The UI badges
  them; `pnpm capture` replaces them with real responses.
- **Wide fan-outs fall back to a deterministic stand-in** derived from a hash of
  the input. It is shaped like a response and means nothing, and it is badged
  differently from a seeded fixture for that reason.
- **Measured figures are withheld rather than estimated.** Without a key there is
  no latency, no cost, and no accuracy scoreboard — the re-rank and bulk demos
  say so instead of showing a number nothing produced.
- **Ties are not rankings.** The re-rank demo reports rank *ranges* on both
  sides, because a tie means the scorer expressed no opinion and `sort` supplied
  the order. Correcting only the baseline would flatter the re-ranker by exactly
  the mechanism the correction exists for.
- **Model prices are dated external data** (Jev read 2026-09-19, Claude models
  2026-06-24) and will go stale. They are used only to project hypothetical
  spend, never to report what a call actually cost.
- Six queries or twelve personas is **a demonstration, not a benchmark**.

## Reference

- [Jev](https://jev-agent.com) · [TypeSafe docs](https://docs.typesafe.ai) ·
  [primitives](https://docs.typesafe.ai/primitives) ·
  [confidence](https://docs.typesafe.ai/confidence)
- [Jev on OpenRouter](https://openrouter.ai/typesafe)
- [Known limitations of Jev 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
