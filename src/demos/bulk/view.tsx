import { AlertTriangle, Play } from "lucide-react"
import { UserRound } from "lucide-react"

import { SourceBadge, UsageReadout } from "@/components/jev/Readouts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { humanize, ms, percent, usd } from "@/lib/format"
import { cn } from "@/lib/utils"
import { JEV_USD_PER_INPUT_TOKEN } from "@shared/jev.ts"

import { CONCURRENCY, REVIEW_BELOW } from "./demo"
import { MAX_ROWS } from "./dataset"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

export function Controls({
  choices,
  rowCount,
  onRowCount,
  onStart,
  loading,
  source,
}: {
  choices: number[]
  rowCount: number
  onRowCount: (next: string) => void
  onStart: () => void
  loading: boolean
  source?: AnswerSource
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 p-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Rows</p>
          <div className="mt-1.5 flex gap-1.5">
            {choices.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onRowCount(String(count))}
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

        {source ? <SourceBadge source={source} /> : null}

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
export function Economics({
  rowCount,
  usage,
  wallClockMs,
  source,
}: {
  rowCount: number
  usage?: JevUsage
  wallClockMs?: number
  source?: AnswerSource
}) {
  if (source !== "live" || !usage) {
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

  const perRow = usage.cost / Math.max(1, rowCount)

  return (
    <Card>
      <div className="flex flex-wrap gap-x-8 gap-y-3 p-4 sm:p-5">
        <Figure label="Rows" value={String(rowCount)} note="4 questions each" />
        {wallClockMs === undefined ? null : (
          <Figure
            label="Wall clock"
            value={ms(wallClockMs)}
            note={`${CONCURRENCY} at a time`}
          />
        )}
        <Figure label="Total cost" value={usd(usage.cost)} note="measured" />
        <Figure label="Per row" value={usd(perRow)} note="measured" />
        <Figure
          label="Projected for 1M rows"
          value={usd(perRow * 1_000_000)}
          note="extrapolated, not measured"
        />
        <div className="ml-auto">
          <UsageReadout usage={usage} calls={rowCount} />
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

export function Histogram({
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
export function ReviewQueue({ queue, total }: { queue: string[]; total: number }) {
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
          Rows where <strong className="text-ink">any</strong> label came back
          flat or below {percent(REVIEW_BELOW, 0)} confidence. They are excluded
          from that label's counts above rather than merely flagged — a label
          the run does not stand behind should not be in the totals.
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

export function Figure({
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

export function Sample({ rows, total }: { rows: { id: string; text: string }[]; total: number }) {
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
