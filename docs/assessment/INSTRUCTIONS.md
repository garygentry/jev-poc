# Jev assessment — instructions for the judging model

**Status:** the contract `scripts/assess.ts` hands you, followed by the evidence bundle.
**Your output:** one Markdown report, and nothing else.
**Your evidence:** only the JSON bundle appended after these instructions.

You are assessing **Jev** — a decisions model that returns typed, calibrated answers
(`choice` / `score` / `noul`) — against a **plain chat-model baseline** asked for the same
structured answers over the same inputs. Your job is to say, from the recordings alone,
which use cases suit Jev best, where it is strongest, and where it is weakest.

---

## 1. The one rule that outranks the rest

**Judge on measured signals only. These recordings have no ground truth.**

- **Never** claim either model was "correct", "right", "more accurate", or "wrong" on any
  answer. The bundle contains no labels, so accuracy is unknowable and asserting it is the
  one forbidden move.
- **Agreement is not correctness.** When Jev and the baseline disagree, that is a recorded
  divergence to describe, not a scoreboard. Either could be the better answer; you do not
  know and must not imply that you do.
- **Use only the bundle.** Do not bring in outside knowledge about these models, their
  vendors, benchmarks, pricing you remember, or how such systems "usually" behave. Every
  number and claim in your report must trace to a field in the evidence JSON. If the bundle
  does not support a statement, do not make it.
- **Label projected vs measured.** Every figure in the bundle is measured from real
  recordings. If you compute a derived figure yourself (a ratio, a total), present it as
  derived and show the inputs.

If following these rules leaves a question unanswerable, say so plainly. "The evidence does
not settle this" is a correct and valuable finding.

---

## 2. What the bundle gives you

A single JSON object with these fields:

- `generatedAt`, `jevModel`, `baselineModel`, `baselineBackend` — provenance.
- `demoCount`, `demosMissingBaseline` — coverage; a demo in `demosMissingBaseline` has no
  baseline side, so it contributes Jev-only signals.
- `groundTruth.available` (always `false`) and its `note` — the guardrail above, restated.
- `notes` — structural facts about the setup you should weave in where relevant.
- `totals` — one rollup across every demo.
- `byShape` — rollups grouped by demo **shape** (`single`, `fanout`, `pairwise`, `rounds`,
  `windowed`, `cascade`). The shape is *how a demo turns input into calls*; it is the most
  useful lens for "where is Jev best suited".
- `byGroup` — rollups grouped by tour section (`foundations`, `engineering`, …).
- `demos[]` — per demo: `cost`, `decisiveness`, `agreement`, `parse`.

### The measured signals, and what each does and does not mean

- **Cost** (`cost`): `jevCostPerCall`, `baselineCostPerCall`, `costRatio` (baseline ÷ Jev),
  plus token totals. Real upstream USD. Jev's output tokens are free; the baseline's output
  tokens are its expensive half — see `notes`. A high `costRatio` means the baseline costs
  more per call, nothing about quality. **If `baselineBackend` is `cli`, do not use the
  baseline cost or token figures at all**: they include the CLI turn's overhead and are not a
  per-call API cost (the `notes` say so). Make cost claims only from an `openrouter` run.
- **Decisiveness** (`decisiveness`): `meanConfidence` and `undecidedShare` for Jev
  (a `noul`'s confidence is its distance from a coin flip). `baselineHasConfidence` is
  `false` — the baseline emits one token with no distribution, by design. Decisiveness is a
  property of Jev's output, **not** evidence it is correct: a confident answer can still be
  wrong, and you cannot check.
- **Agreement** (`agreement`): `agreementRate`, a `byType` breakdown, and up to a handful of
  concrete `disagreements`. This is where the two models diverge. Report it as the texture of
  the comparison, and read the shape of *where* they part (which question types, which demos).
- **Parse-reliability** (`parse`): `parseOkRate` — how often the baseline's raw reply parsed
  into the required shape on its own. Jev is always well-typed by construction, so this is a
  real structural asymmetry: a low baseline `parseOkRate` is a cost of the prose-to-struct
  path that Jev does not pay. A missing/failed parse is a mechanical fact, not a quality one.

A `null` rate means "no data to compute it from" — treat it as absent, never as zero.

---

## 3. The report to write

Match the house style of `README.md` and `docs/EXPANSION-PLAN.md`: a title, a short bolded
metadata line (date, models, demo count — take these from the bundle), numbered `##` sections,
tables where they earn their place, and honest labelling of every number.

Write these sections, in order:

1. **Executive summary** — three to five sentences. What the evidence supports about where
   Jev fits, stated as measured findings, with the ground-truth caveat up front.
2. **Best-fit use cases** — where the measured signals most favour Jev (cost structure,
   decisiveness, parse-reliability, batching leverage by shape). Tie each claim to specific
   bundle numbers. Rank them.
3. **Where Jev is strongest** — organised by **shape** (and group where it adds something).
   For each, name the measured reason. This is the core of the assessment.
4. **Where Jev is weakest / where the baseline holds its own** — high disagreement with no
   way to adjudicate, thin coverage, demos where the cost gap is small, or shapes where the
   structural advantage is least. Be specific and fair; the baseline is not the villain.
5. **Cost** — the measured cost story across demos and shapes, Jev's free output tokens
   included, `costRatio` read carefully (cost, not value).
6. **Decisiveness & calibration** — what Jev's confidence distribution looks like and the
   `undecidedShare`, with the explicit note that decisiveness ≠ accuracy and that the
   baseline offers no confidence at all.
7. **Agreement & disagreement** — the rate overall and by type, and what the concrete
   disagreements suggest about *where* the two models pull apart. No winner declared.
8. **Limits of this evidence** — the ground-truth absence, a single baseline model, small
   sample sizes per demo, any demos in `demosMissingBaseline`, the excluded offline/synthetic
   demos, and the reminder that agreement is not correctness. This section is mandatory and
   must be honest, not perfunctory.

End there. Output only the report.
