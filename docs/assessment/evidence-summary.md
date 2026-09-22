# Evidence summary

**Generated:** 2026-09-22T00:00:32.273Z · **Jev:** typesafe/jev-1.13-20260917 · **Baseline:** anthropic/claude-haiku-4.5 (openrouter)

Measured signals only — no ground truth, so no accuracy. Authoritative data is `evidence.json`; this table is for eyeballing it.

## Per demo

| demo | shape | Jev $/call | base $/call | ratio | agree | Jev undecided | base parsed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| alert-dedup | pairwise | $0.000018 | $0.000491 | 27.7× | 96% | 0% | 100% |
| cascade | cascade | $0.000022 | $0.000652 | 29.4× | 90% | 10% | 100% |
| clause-risk | fanout | $0.000027 | $0.001002 | 37.3× | 100% | 0% | 100% |
| context-pruner | fanout | $0.000019 | $0.000507 | 26.9× | 90% | 5% | 100% |
| doc-sweep | windowed | $0.000019 | $0.000515 | 26.9× | 100% | 0% | 100% |
| done-check | single | $0.000036 | $0.001336 | 37.0× | 97% | 0% | 100% |
| flaky-triage | single | $0.000024 | $0.000678 | 28.2× | 92% | 8% | 100% |
| guardrail | single | $0.000029 | $0.001347 | 46.6× | 87% | 7% | 100% |
| loop-detector | windowed | $0.000020 | $0.000538 | 27.5× | 97% | 0% | 100% |
| moderation | single | $0.000044 | $0.001946 | 44.1× | 97% | 0% | 100% |
| personas | fanout | $0.000025 | $0.000804 | 32.5× | 79% | 11% | 100% |
| pr-triage | single | $0.000036 | $0.001356 | 37.3× | 97% | 3% | 100% |
| rerank | fanout | $0.000018 | $0.000488 | 26.4× | 99% | 1% | 100% |
| router | single | $0.000033 | $0.001338 | 40.5× | 90% | 0% | 100% |
| semantic-grep | fanout | $0.000017 | $0.000454 | 26.6× | 100% | 0% | 100% |
| taxonomy | rounds | $0.000019 | $0.000491 | 26.5× | 95% | 0% | 100% |
| triage | single | $0.000029 | $0.001405 | 49.3× | 96% | 4% | 100% |
| typewriter | single | $0.000039 | $0.002238 | 57.6× | 83% | 5% | 100% |

## By shape

| shape | demos | cost ratio | agree | Jev mean confidence | base parsed |
| --- | --- | --- | --- | --- | --- |
| pairwise | 1 | 27.7× | 96% | 0.85 | 100% |
| cascade | 1 | 29.4× | 90% | 0.58 | 100% |
| fanout | 5 | 28.3× | 94% | 0.78 | 100% |
| windowed | 2 | 27.5× | 98% | 0.81 | 100% |
| single | 8 | 42.8× | 92% | 0.80 | 100% |
| rounds | 1 | 26.5× | 95% | 0.92 | 100% |


