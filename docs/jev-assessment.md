# Jev assessment: Jev vs. a plain chat baseline

**Generated:** 2026-09-22 · **Jev:** `typesafe/jev-1.13-20260917` · **Baseline:** `anthropic/claude-haiku-4.5` via `openrouter` · **Demos:** 18 (0 missing a baseline) · **Ground truth:** none

Every figure below is **measured** and comes from the evidence bundle, unless it is marked **derived**. Derived figures show their inputs.

---

## 1. Executive summary

These recordings have no ground truth, so nothing here says which model was right. The findings are about cost, structure, decisiveness and where the two models diverge.

- **Cost.** Over 353 paired calls (derived: the sum of per-demo `jevCalls`), the baseline cost **31.1×** more per call than Jev ($0.000667 vs $0.0000214). No demo came in under 26×.
- **Agreement.** The two models agreed on **93.1%** of 691 compared answers under a loose rule.
- **Where they diverge.** Agreement was lowest on graded `score` questions (**74.3%**, derived) and on subjective, multi-attribute demos (`personas` 79.2%, `typewriter` 83.3%). It was highest on high-volume yes/no filtering (`rerank` 99.3%, `windowed` shape 97.7%).
- **Best fit.** The evidence best supports Jev for two kinds of work:
  - high-volume, per-item gating, where the cost gap is at least 26× and the absolute saving is largest;
  - many-answers-per-call extraction, where the per-call cost ratio peaks at 44–58×.
- **Parse reliability** was 100% for the baseline in this run. Jev's typed-output advantage is real by construction, but it cost the baseline nothing here.

## 2. Best-fit use cases

These are ranked by how strongly the measured signals favour Jev.

| Rank | Use case | Demos | Measured basis |
|---|---|---|---|
| 1 | **High-volume per-item gating** (relevance filters, re-ranking, window checks) | `rerank`, `loop-detector`, `context-pruner`, `semantic-grep` | 212 of 353 calls (derived: 144+38+21+9). Cost ratio 26.4–27.5×. `rerank` had the largest absolute cost gap: $0.0703 vs $0.00266, a derived difference of $0.0676, nearly 29% of the total baseline spend ($0.2354). Agreement 0.90–1.00. |
| 2 | **Multi-attribute extraction in one call** (moderation, message review, triage) | `moderation`, `typewriter`, `guardrail`, `triage` | Highest cost ratios in the bundle: 44.1×, 57.6×, 46.6×, 49.3×. These demos return 6–12 answers per call (derived: `moderation` 72/6, `typewriter` 60/5, `guardrail` 54/9, `triage` 28/4). The baseline also used 1.5–1.8× Jev's input tokens here (derived, e.g. `typewriter` 8333 vs 4628). |
| 3 | **Binary policy or classification gates where Jev is decisive** | `moderation`, `semantic-grep`, `clause-risk` | Mean confidence 0.956, 0.947 and 0.822. Undecided share 0 in all three. Agreement 0.972, 1.00 and 1.00. |
| 4 | **Structured pipelines that consume typed output** | all | Jev is well-typed by construction, and the baseline's `parseOkRate` was 1.0 (353/353). This asymmetry is structural only; it did not show up as failures in this run. |

## 3. Where Jev is strongest

### By shape

| Shape | Demos | Calls (derived) | Cost ratio | Agreement | Mean conf. |
|---|---|---|---|---|---|
| windowed | 2 | 43 | 27.5× | **0.977** | 0.809 |
| pairwise | 1 | 25 | 27.7× | 0.960 | 0.851 |
| rounds | 1 | 15 | 26.5× | 0.947 | **0.921** |
| fanout | 5 | 218 | 28.3× | 0.935 | 0.780 |
| single | 8 | 47 | **42.8×** | 0.918 | 0.802 |
| cascade | 1 | 5 | 29.4× | 0.900 | 0.583 |

Calls are derived as shape `jevCost` ÷ `jevCostPerCall`; they match the per-demo sums.

- **Windowed** (`loop-detector`, `doc-sweep`) has the tightest profile in the bundle:
  - agreement 42/43 (derived);
  - undecided share 0 in both demos;
  - mean confidence 0.809.

  Every answer is a `noul`.
- **Fanout** carries most of the evidence (218 calls, 278 answers, derived). Most of Jev's cost advantage in dollars lives here: the baseline spent $0.1220 against Jev's $0.00432 (derived gap $0.1177). `rerank` (143/144 agree, confidence 0.897) and `semantic-grep` (9/9, confidence 0.947) are the cleanest demos.
- **Single** has the highest cost ratio (42.8×). Both sides cost more per call here (Jev $0.0000336, baseline $0.00144), because each call returns many answers. The measured reason Jev fits here is cost per call, not agreement.
- **Pairwise** (`alert-dedup`) and **rounds** (`taxonomy`) look favourable: 0.960 and 0.947 agreement, 0 undecided, and `taxonomy` has Jev's second-highest mean confidence (0.921). But each rests on one demo (see §4).

### By group

- **documents** (`clause-risk`, `doc-sweep`) had agreement 1.00 on all 37 answers (derived: 32+5).
- **safety** (`moderation`) had the highest group mean confidence (0.956) and a 44.1× cost ratio.
- **engineering** had agreement 0.961 and mean confidence 0.840.

## 4. Where Jev is weakest, and where the baseline holds its own

- **Graded `score` questions.** Agreement was 55/74 = **74.3%** (derived), compared with 96.2% for `noul` (527/548) and 88.4% for `choice` (61/69). There is no ground truth, so this is where the two models' judgements differ most, and the bundle cannot say which reading to trust.
  - `personas` alone contributes 36 of the 74 score comparisons at 24/36. Without it, score agreement is 31/38 = 81.6% (derived).
- **Subjective, audience- or tone-dependent judgements.**
  - `personas`: agreement 0.792, Jev mean confidence **0.514**, the lowest in the bundle, with 11.1% undecided.
  - `typewriter`: agreement 0.833, confidence 0.734.

  Jev is least decisive here and diverges most, so its per-answer confidence is at its weakest as a routing signal.
- **Command safety edge cases.** `guardrail` had agreement 0.870 and 7.4% undecided (4 of 54). It holds the widest categorical split in the bundle: on `cat-env` / `blast_radius`, Jev said `read_only` and the baseline said `catastrophic`. The `test` command diverged on three questions at once. This is a high-stakes use case with divergences that cannot be settled here.
- **Cascade** has the second-lowest confidence (0.583), 10% undecided and agreement 0.90, from one demo of only 5 calls.
- **Thin coverage.** Pairwise, rounds and cascade each rest on a single demo with 25, 15 and 5 calls. Their favourable numbers are not robust.
- **Where the cost gap is smallest.** Rounds (26.5×), windowed (27.5×) and pairwise (27.7×), and at demo level `rerank` (26.4×) and `semantic-grep` (26.6×). Even the smallest ratio is over 26×, so no demo shows the baseline near cost parity.
- **Where the baseline holds its own.** The baseline parsed every reply (353/353). It agreed with Jev on 93.1% of answers overall and 100% in three demos (`clause-risk`, `doc-sweep`, `semantic-grep`). On structural reliability, the recordings show no weakness in the baseline.

## 5. Cost

All cost figures are real upstream USD from an `openrouter` run, so they are usable.

- **Totals.** Jev $0.00756, baseline $0.2354. Per call: Jev $0.0000214, baseline $0.000667. Ratio **31.1×**.
- **Range across demos.** Lowest 26.4× (`rerank`); highest **57.6×** (`typewriter`). The single-call, many-answer demos cluster at the top (37.0–57.6×). The fanout, windowed and rounds demos cluster at 26–28×, except `clause-risk` (37.3×) and `personas` (32.5×).
- **Output tokens.** Jev emitted more output tokens than the baseline in every demo (e.g. `rerank` 3168 vs 1548, `typewriter` 1341 vs 571). Per the bundle notes, Jev's output tokens are free, while output is the baseline's expensive half. That asymmetry is built into every ratio above.
- **Input tokens.**
  - In the single-call demos, the baseline used noticeably more input tokens than Jev (e.g. `guardrail` 9416 vs 6200, `triage` 4261 vs 2717).
  - In the per-item fanouts, the two were nearly equal (`rerank` 62,562 vs 63,318; `semantic-grep` 3650 vs 3655).

  This tracks the per-demo spread in `costRatio`.
- **Reading `costRatio`.** It measures what each call costs, not what the answer is worth. A 57.6× ratio in `typewriter` sits alongside that demo's second-lowest agreement (0.833). The cost advantage and the divergence are separate facts.

## 6. Decisiveness and calibration

- **Overall.** Jev's mean confidence was **0.795**. 21 of 691 answers were undecided, **3.0%** (derived: the sum of `undecidedShare × answers`). 9 of 18 demos had zero undecided answers.
- **Most decisive:** `moderation` 0.956, `semantic-grep` 0.947, `taxonomy` 0.921, `rerank` 0.897.
- **Least decisive:** `personas` 0.514 (11.1% undecided), `cascade` 0.583 (10%), `guardrail` 0.694 (7.4%), `typewriter` 0.734 (5%).
- **Co-movement.** In this bundle, the demos where Jev is least decisive (`personas`, `cascade`, `guardrail`, `typewriter`) are also among those with the lowest agreement. This co-movement is an observation only; the bundle cannot say whether low confidence marks genuinely harder items.
- **Confident divergences.** Several disagreements have Jev confidently on one side:
  - `done-check` 0.07
  - `moderation` 0.10 and 0.12
  - `alert-dedup` 0.18
  - `typewriter` `has_clear_ask` 0.18

  **Decisiveness is not accuracy.** A confident answer can be wrong, and nothing here can check it.
- **The baseline has no confidence.** `baselineHasConfidence` is `false` for every demo. It returns one point value per question, with no distribution to calibrate, abstain on or route by. That is a real capability difference in the output format. It is not a statement about which answers are better.

## 7. Agreement and disagreement

**Overall: 643/691 = 93.1%.** The agreement rule is loose by design:

- a `choice` agrees on an exact match;
- a `score` agrees when Jev's rounded level equals the baseline's level;
- a `noul` agrees when both land on the same side of 0.5.

| Type | Compared | Agree | Rate (derived) |
|---|---|---|---|
| noul | 548 | 527 | 96.2% |
| choice | 69 | 61 | 88.4% |
| score | 74 | 55 | 74.3% |

These patterns come from the listed disagreements, which are a sample (e.g. `personas` lists 8 of 15):

- **Score levels.** Of the 12 listed score disagreements, Jev's level was **one step lower** than the baseline's in 10. Examples are all six `personas` `lands` cases, `pr-triage` `blast_radius` (1.22 vs 2) and `guardrail` `reset-hard` reversibility (1.29 vs 2). The two exceptions (`guardrail` `test` reversibility 0.53 vs 0; `triage` `chargeback-threat` 0.79 vs 0) go the other way. So on graded scales the divergence has a direction, not just noise. The bundle cannot say which side is better placed.
- **`noul` splits go both ways.**
  - The baseline was higher on detection-style flags: `self_harm` 0.70 vs 0.10, `pii` 0.70 vs 0.12, `contains_pii` 0.85 vs 0.24, `touches_secrets` 0.70 vs 0.21, `stuck` 0.85 vs 0.27, `same_incident` 0.75 vs 0.18.
  - Jev was higher on relevance and readiness: `context-pruner` 0.60 vs 0.15 and 0.74 vs 0.30, `ready_to_send` 0.65 and 0.73 vs 0.20.
- **Near-boundary cases.** Some disagreements sit at or near the 0.5 line:
  - the baseline answered exactly 0.50 in `done-check` (Jev 0.07) and `flaky-triage` (Jev 0.37);
  - Jev sat at 0.49 (`rerank`), 0.51 and 0.53 (`guardrail`).

  Under this rule, such cases flip on small differences.
- **Categorical `choice` splits** are mostly between adjacent categories: `involved` vs `expert`, `reasoning` vs `expert`, `neutral` vs `warm`, and `payment_method_change` vs `failed_payment_recovery`. The one large categorical gap is `guardrail` `cat-env` (`read_only` vs `catastrophic`).

This section declares no winner. Each row is a recorded divergence between two readings of the same input.

## 8. Limits of this evidence

- **No ground truth.** `groundTruth.available` is `false`. No statement here, and none that could be drawn from this bundle, says which model answered correctly. Agreement is not correctness: two models can agree and both be wrong, or disagree with either one right.
- **One baseline model.** Every comparison is against `anthropic/claude-haiku-4.5` alone. The findings, including the cost ratios, describe this pairing and may not hold for other baselines.
- **Small samples.**
  - Three shapes (pairwise, rounds, cascade) rest on one demo each. `cascade` has 5 calls.
  - Several demos have fewer than 15 answers (`doc-sweep` 5, `semantic-grep` 9, `cascade` 10, `flaky-triage` 12).
  - A single disagreement moves those rates by 7–20 points.
  - `rerank` contributes 144 of 691 answers (20.8%, derived) and pulls up the overall and fanout agreement figures.
- **Disagreement lists are samples.** Some demos list fewer disagreements than they recorded (`personas` 8 of 15, `typewriter` 8 of 10). The directional patterns in §7 come from the listed cases only.
- **A loose agreement rule.** Rounding scores to a level, and splitting `noul` at 0.5, both hide how far apart the answers are. They also make near-boundary cases fragile.
- **Coverage.** `demosMissingBaseline` is empty, so every included demo has both sides. Only demos with a committed Jev fixture are included; the offline demo and the synthetic wide fan-outs are **excluded**. Their behaviour, including how batching leverage scales at wider fan-outs, is not measured here.
- **Parse reliability was not stressed.** `parseOkRate` of 1.0 in every demo means this run shows no prose-to-struct failure cost. Other runs or prompts might, but this evidence does not.
- **Decisiveness is self-reported.** Jev's confidence cannot be checked for calibration without labels. The baseline gives no confidence to compare it with.
