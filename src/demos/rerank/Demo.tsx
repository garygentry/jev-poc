import { useCallback, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Minus, Target } from "lucide-react"

import { WirePanel } from "@/components/jev/WirePanel"
import { UsageReadout } from "@/components/jev/Readouts"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"
import { batch } from "@/lib/jev-client"
import { useSpend } from "@/lib/spend-context"
import { ms, percent } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PASSAGES, QUERIES, stateFor } from "./corpus"
import { QUESTIONS } from "./questions"
import { boundsOf, keywordScore, rankWithBounds, type Ranked } from "./baseline"

import type { AnswerSource, JevUsage, JevWire } from "@shared/jev.ts"

const demo = demoBySlug("rerank")!

interface RunState {
  ranked: Ranked[]
  usage: JevUsage
  wallClockMs: number
  source: AnswerSource
  wire: JevWire
}

export default function RerankDemo() {
  const [selected, setSelected] = useState(QUERIES[0]!.id)
  const [result, setResult] = useState<RunState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { refresh } = useSpend()

  const query = QUERIES.find((item) => item.id === selected)!

  const baseline = useMemo(
    () =>
      rankWithBounds(
        PASSAGES.map((passage) => ({
          id: passage.id,
          score: keywordScore(query.text, passage),
        })),
      ),
    [query],
  )

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    const items = PASSAGES.map((passage) => ({
      id: passage.id,
      state: stateFor(query, passage),
    }))

    try {
      const response = await batch({
        items,
        questions: QUESTIONS,
        fixtureKey: `rerank/${query.id}`,
      })

      const scores = response.results.map((row) => {
        const answer = row.answers?.relevant
        return {
          id: row.id,
          score: answer?.type === "noul" ? answer.noul : 0,
        }
      })

      setResult({
        ranked: rankWithBounds(scores),
        usage: response.usage,
        wallClockMs: response.wallClockMs,
        source: response.source,
        wire: {
          request: {
            note: `${items.length} separate requests — one per candidate. Shown: the first.`,
            model: "typesafe/jev-1.13",
            state: items[0]!.state,
            questions: QUESTIONS,
          },
          response: response.results.slice(0, 3),
        },
      })
      void refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [query, refresh])

  return (
    <DemoFrame demo={demo}>
      <RunBar
        examples={QUERIES.map((item) => ({
          id: item.id,
          label: `${item.id} · ${item.text.slice(0, 34)}…`,
        }))}
        selected={selected}
        onSelect={(id) => {
          setSelected(id)
          setResult(null)
        }}
        onRun={() => void run()}
        loading={loading}
        runLabel={`Re-rank ${PASSAGES.length} passages`}
        usage={result?.usage}
        calls={result ? PASSAGES.length : undefined}
        source={result?.source}
      />

      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <div className="p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Customer asked
          </p>
          <p className="mt-1 text-sm text-ink">“{query.text}”</p>
          <p className="mt-2 text-[11px] text-ink-muted">
            The passage that answers it is{" "}
            <span className="font-mono text-ink">{query.gold}</span>, fixed
            before either ranker was run.
          </p>
        </div>
      </Card>

      {result ? (
        <Scoreboard query={query} baseline={baseline} result={result} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Column
          title="Keyword baseline"
          subtitle="Content-word overlap. No length normalisation, so it favours longer passages."
          ranked={baseline}
          gold={query.gold}
          format={(score) => `${score} word${score === 1 ? "" : "s"}`}
        />
        <Column
          title="Jev re-rank"
          subtitle="One noul per passage, sorted by probability."
          ranked={result?.ranked ?? null}
          gold={query.gold}
          format={(score) => percent(score, 1)}
          compareTo={baseline}
          loading={loading}
        />
      </div>

      {result ? <WirePanel wire={result.wire} /> : null}

      <Caveats />
    </DemoFrame>
  )
}

/**
 * The measured comparison — shown only when the model actually answered.
 *
 * A scoreboard computed from replayed or synthetic values would be a fabricated
 * result, and this demo's entire claim is a measured one. The mechanism above
 * still demonstrates itself offline; the number does not.
 */
function Scoreboard({
  query,
  baseline,
  result,
}: {
  query: { gold: string }
  baseline: Ranked[]
  result: RunState
}) {
  if (result.source !== "live") {
    return (
      <Card className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <Target
            className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-ink)]"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">
              No accuracy figure without a key.
            </span>{" "}
            The fan-out, the per-passage probabilities and the sort all work
            from replayed data — but a hit rate computed from answers the model
            did not give would be a fabricated result, so it is withheld rather
            than estimated.
          </p>
        </div>
      </Card>
    )
  }

  const before = boundsOf(baseline, query.gold)
  const after = boundsOf(result.ranked, query.gold)

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4 sm:p-5">
        <Stat
          label="Gold rank, keyword"
          value={before ? rangeLabel(before) : "—"}
        />
        <Stat label="Gold rank, re-ranked" value={after ? rangeLabel(after) : "—"} />
        <Stat label="Wall clock" value={ms(result.wallClockMs)} />
        <div className="ml-auto">
          <UsageReadout usage={result.usage} calls={result.ranked.length} />
        </div>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Both sides report a <strong>range</strong>, not a position. Where a
          scorer ties, it expressed no opinion and the sort supplied the order —
          calling that a rank would turn “no signal” into “wrong answer”.
        </p>
      </div>
    </Card>
  )
}

const rangeLabel = ([low, high]: [number, number]) =>
  low === high ? `#${low}` : `#${low}–${high}`

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

function Column({
  title,
  subtitle,
  ranked,
  gold,
  format,
  compareTo,
  loading,
}: {
  title: string
  subtitle: string
  ranked: Ranked[] | null
  gold: string
  format: (score: number) => string
  compareTo?: Ranked[]
  loading?: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-3">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{subtitle}</p>
      </div>

      {!ranked ? (
        <p className="p-6 text-center text-sm text-ink-muted">
          {loading ? "Fanning out…" : "Not run yet."}
        </p>
      ) : (
        <ol className="max-h-[520px] divide-y divide-[var(--hairline)] overflow-auto">
          {ranked.slice(0, 12).map((row) => {
            const passage = PASSAGES.find((item) => item.id === row.id)!
            const isGold = row.id === gold
            const moved = compareTo ? movement(compareTo, ranked, row.id) : null

            return (
              <li
                key={row.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-2",
                  isGold && "bg-[var(--mark)]/10",
                )}
              >
                <span className="tabular w-12 shrink-0 font-mono text-[11px] text-ink-muted">
                  {rangeLabel(row.bounds)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs",
                      isGold ? "font-medium text-ink" : "text-ink-secondary",
                    )}
                  >
                    {passage.title}
                  </p>
                  <p className="font-mono text-[10px] text-ink-muted">{row.id}</p>
                </div>
                {moved ? <Movement delta={moved} /> : null}
                <span className="tabular shrink-0 text-[11px] text-ink-muted">
                  {format(row.score)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/** Change in the *midpoint* of the bounds, since a tie has no single position. */
function movement(before: Ranked[], after: Ranked[], id: string): number | null {
  const a = boundsOf(before, id)
  const b = boundsOf(after, id)
  if (!a || !b) return null
  const mid = (bounds: [number, number]) => (bounds[0] + bounds[1]) / 2
  return mid(a) - mid(b)
}

/**
 * Movement between the two rankings.
 *
 * Deliberately not colored green/red: a passage moving down is not "bad" — most
 * of them *should* move down — and status colors are reserved for actual
 * good/critical states. The arrow alone carries the direction.
 */
function Movement({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) {
    return <Minus className="size-3 shrink-0 text-ink-muted" aria-label="unchanged" />
  }
  const up = delta > 0
  return (
    <span
      className="tabular inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted"
      aria-label={`moved ${up ? "up" : "down"} ${Math.abs(delta).toFixed(1)} places`}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta).toFixed(1)}
    </span>
  )
}

function Caveats() {
  return (
    <Card>
      <div className="space-y-2 p-4 text-[11px] leading-relaxed text-ink-muted sm:p-5">
        <p className="font-medium text-ink-secondary">
          What this is and is not
        </p>
        <p>
          <strong className="text-ink-secondary">The baseline is crude and
          biased in its own favour.</strong>{" "}
          It does no length normalisation, so longer passages match more words.
          That makes the comparison conservative rather than rigged, but it is
          not neutral.
        </p>
        <p>
          <strong className="text-ink-secondary">Six queries is a
          demonstration, not a benchmark.</strong>{" "}
          The passages were written first as documentation; the queries were
          written afterwards but before either ranker ran, in a customer's words
          rather than the documentation's. Neither set was edited after seeing a
          result.
        </p>
        <p>
          <strong className="text-ink-secondary">Ties are reported as
          ranges on both sides.</strong>{" "}
          Giving the baseline a range and the re-ranker a point estimate would
          flatter the re-ranker by precisely the mechanism the range exists to
          correct.
        </p>
      </div>
    </Card>
  )
}
