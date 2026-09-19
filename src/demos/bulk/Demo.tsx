import { useCallback, useMemo, useState } from "react"
import { AlertTriangle, Play, UserRound } from "lucide-react"

import { WirePanel } from "@/components/jev/WirePanel"
import { UsageReadout } from "@/components/jev/Readouts"
import { SourceBadge } from "@/components/jev/Readouts"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote } from "@/components/layout/RunBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"
import { batch } from "@/lib/jev-client"
import { useSpend } from "@/lib/spend-context"
import { humanize, ms, percent, usd } from "@/lib/format"
import { cn } from "@/lib/utils"
import { JEV_USD_PER_INPUT_TOKEN } from "@shared/jev.ts"

import { QUESTIONS, REVIEW_BELOW } from "./questions"
import { DEFAULT_ROWS, MAX_ROWS, buildDataset } from "./dataset"
import { countNoul, meanScore, tally } from "./summarize"

import type { AnswerSource, BatchItemResult, JevUsage, JevWire } from "@shared/jev.ts"

const demo = demoBySlug("bulk")!

/** Mirrors the server's own cap; the server clamps regardless. */
const CONCURRENCY = 8

const ROW_CHOICES = [20, 60, 120, MAX_ROWS]

interface Run {
  results: BatchItemResult[]
  usage: JevUsage
  wallClockMs: number
  source: AnswerSource
  wire: JevWire
}

export default function BulkDemo() {
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { refresh } = useSpend()

  const rows = useMemo(() => buildDataset(rowCount), [rowCount])

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRun(null)

    const items = rows.map((row) => ({ id: row.id, state: { feedback: row.text } }))

    try {
      const response = await batch({
        items,
        questions: QUESTIONS,
        concurrency: CONCURRENCY,
      })
      setRun({
        results: response.results,
        usage: response.usage,
        wallClockMs: response.wallClockMs,
        source: response.source,
        wire: {
          request: {
            note: `${items.length} requests, ${CONCURRENCY} at a time. Shown: the first.`,
            model: "typesafe/jev-1.13",
            state: items[0]!.state,
            questions: QUESTIONS,
          },
          response: response.results.slice(0, 2),
        },
      })
      void refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [rows, refresh])

  const sentiment = run ? tally(run.results, "sentiment") : null
  const theme = run ? tally(run.results, "theme") : null
  const severity = run ? meanScore(run.results, "severity") : null
  const actionable = run ? countNoul(run.results, "is_actionable") : null

  return (
    <DemoFrame demo={demo}>
      <Controls
        rowCount={rowCount}
        onRowCount={(next) => {
          setRowCount(next)
          setRun(null)
        }}
        onStart={() => void start()}
        loading={loading}
        run={run}
      />

      {error ? <ErrorNote message={error} /> : null}

      {run ? (
        <>
          <Economics run={run} rowCount={rows.length} />

          <div className="grid gap-4 md:grid-cols-2">
            {sentiment ? (
              <Histogram
                title="Sentiment"
                subtitle={`${sentiment.labelled} of ${rows.length} rows confident enough to count`}
                counts={sentiment.counts}
                total={sentiment.labelled}
              />
            ) : null}
            {theme ? (
              <Histogram
                title="Theme"
                subtitle={`${theme.labelled} of ${rows.length} rows confident enough to count`}
                counts={theme.counts}
                total={theme.labelled}
              />
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="space-y-3 p-4 sm:p-5">
                <h3 className="text-sm font-medium text-ink">Other labels</h3>
                {severity ? (
                  <Figure
                    label="Mean severity"
                    value={`${severity.mean.toFixed(2)} / 2`}
                    note={`over ${severity.counted} readable rows`}
                  />
                ) : null}
                {actionable ? (
                  <Figure
                    label="Actionable as written"
                    value={percent(actionable.held / Math.max(1, actionable.counted), 0)}
                    note={`${actionable.held} of ${actionable.counted}`}
                  />
                ) : null}
              </div>
            </Card>

            {sentiment ? (
              <ReviewQueue queue={sentiment.review} total={rows.length} />
            ) : null}
          </div>

          <WirePanel wire={run.wire} />
        </>
      ) : null}

      <Sample rows={rows.slice(0, 4)} total={rows.length} />
    </DemoFrame>
  )
}

function Controls({
  rowCount,
  onRowCount,
  onStart,
  loading,
  run,
}: {
  rowCount: number
  onRowCount: (next: number) => void
  onStart: () => void
  loading: boolean
  run: Run | null
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 p-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Rows</p>
          <div className="mt-1.5 flex gap-1.5">
            {ROW_CHOICES.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onRowCount(count)}
                aria-pressed={rowCount === count}
                className={cn(
                  "tabular rounded-md border px-2.5 py-1 text-xs transition-colors",
                  rowCount === count
                    ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                    : "border-[var(--hairline)] text-ink-secondary hover:text-ink",
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Concurrency
          </p>
          <p className="tabular mt-1.5 text-sm text-ink">{CONCURRENCY}</p>
        </div>

        <Button onClick={onStart} disabled={loading}>
          <Play />
          {loading ? `Labelling ${rowCount} rows…` : `Label ${rowCount} rows`}
        </Button>

        {run ? <SourceBadge source={run.source} /> : null}

        <p className="w-full text-[11px] leading-relaxed text-ink-muted">
          Capped at {MAX_ROWS} rows and {CONCURRENCY} concurrent requests, enforced
          on the server rather than trusted from here. Nothing runs until you
          click — a fan-out is the one place in this app where a stray render
          could cost real money.
        </p>
      </div>
    </Card>
  )
}

/**
 * What the run cost and what it would have cost elsewhere.
 *
 * The measured half comes from `usage` on real responses. The comparison half
 * is explicitly a projection and says so — there is no second model in this
 * app to have actually raced.
 */
function Economics({ run, rowCount }: { run: Run; rowCount: number }) {
  if (run.source !== "live") {
    return (
      <Card className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-ink)]"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">
              No cost or timing figures without a key.
            </span>{" "}
            These {rowCount} rows were answered from a deterministic stand-in, so
            there is no spend and no wall clock to report. The label
            distribution below is shaped noise — it demonstrates the mechanism,
            not a result.
          </p>
        </div>
      </Card>
    )
  }

  const perRow = run.usage.cost / Math.max(1, rowCount)

  return (
    <Card>
      <div className="flex flex-wrap gap-x-8 gap-y-3 p-4 sm:p-5">
        <Figure label="Rows" value={String(rowCount)} note="4 questions each" />
        <Figure label="Wall clock" value={ms(run.wallClockMs)} note={`${CONCURRENCY} at a time`} />
        <Figure label="Total cost" value={usd(run.usage.cost)} note="measured" />
        <Figure label="Per row" value={usd(perRow)} note="measured" />
        <Figure
          label="Projected for 1M rows"
          value={usd(perRow * 1_000_000)}
          note="extrapolated, not measured"
        />
        <div className="ml-auto">
          <UsageReadout usage={run.usage} calls={rowCount} />
        </div>
      </div>
      <div className="border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Output tokens are free at ${(JEV_USD_PER_INPUT_TOKEN * 1_000_000).toFixed(3)}/M
          input, which is what changes the arithmetic: the fourth question costs
          only the input tokens its own text adds, so labelling everything
          becomes cheaper than deciding what to sample.
        </p>
      </div>
    </Card>
  )
}

function Histogram({
  title,
  subtitle,
  counts,
  total,
}: {
  title: string
  subtitle: string
  counts: Record<string, number>
  total: number
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, count]) => count))

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-[11px] text-ink-muted">{subtitle}</p>

        <ul className="mt-3 space-y-2.5">
          {entries.map(([label, count]) => (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs capitalize text-ink-secondary">
                  {humanize(label)}
                </span>
                <span className="tabular text-xs text-ink">
                  {count}{" "}
                  <span className="text-ink-muted">
                    {percent(count / Math.max(1, total), 0)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--gridline)]">
                <div
                  className="h-full rounded-full bg-[var(--mark)]"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="text-xs text-ink-muted">
              No row cleared the confidence floor.
            </li>
          ) : null}
        </ul>
      </div>
    </Card>
  )
}

/**
 * The rows the run declined to label.
 *
 * This is the output worth having. Anything can produce a histogram; knowing
 * which rows not to trust is what makes the histogram usable.
 */
function ReviewQueue({ queue, total }: { queue: string[]; total: number }) {
  return (
    <Card
      className={cn(
        queue.length > 0 &&
          "border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5",
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <UserRound
            className="size-4 shrink-0 text-[var(--status-warning-ink)]"
            aria-hidden
          />
          <h3 className="text-sm font-medium text-ink">Human review queue</h3>
          <Badge variant="outline" className="tabular ml-auto">
            {queue.length} of {total}
          </Badge>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">
          Rows whose distribution was flat, or below {percent(REVIEW_BELOW, 0)}{" "}
          confidence. They are excluded from the counts above rather than merely
          flagged — a label the run does not stand behind should not be in the
          totals.
        </p>

        {queue.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {queue.slice(0, 40).map((id) => (
              <span
                key={id}
                className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
              >
                {id}
              </span>
            ))}
            {queue.length > 40 ? (
              <span className="px-1.5 py-0.5 text-[10px] text-ink-muted">
                +{queue.length - 40} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function Figure({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-ink">{value}</p>
      {note ? <p className="text-[10px] text-ink-muted">{note}</p> : null}
    </div>
  )
}

function Sample({ rows, total }: { rows: { id: string; text: string }[]; total: number }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h3 className="text-sm font-medium text-ink">The corpus</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
          {total} rows, generated deterministically from phrase parts so there is
          enough of it to make the economics visible. There is no ground truth
          here — this demo measures cost, throughput and the shape of what came
          back, never accuracy.
        </p>
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-2.5 text-[11px]">
              <span className="font-mono text-ink-muted">{row.id}</span>
              <span className="text-ink-secondary">{row.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
