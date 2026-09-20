import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { percent } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { Sample } from "./data"
import type { Metrics } from "./policy"

/**
 * The recorded answers laid out by score, coloured by truth, with the threshold
 * drawn through them.
 *
 * This is the whole argument in one picture: relevant and irrelevant chunks
 * overlap in the middle, so wherever the line falls it cuts through some of both
 * — and moving it trades a false positive for a false negative. A guessed number
 * lands somewhere in that overlap blind; a fitted one lands where the mistakes
 * are fewest.
 */
export function SampleStrip({ samples, threshold }: { samples: Sample[]; threshold: number }) {
  return (
    <div className="relative h-16 w-full rounded-md border border-[var(--hairline)] bg-[var(--surface)]">
      {/* the threshold line */}
      <div
        className="absolute inset-y-0 z-10 w-px bg-[var(--ink)]"
        style={{ left: `${threshold * 100}%` }}
      >
        <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] tabular text-ink">
          {percent(threshold, 0)}
        </span>
      </div>
      {/* predicted-positive shading, to the right of the line */}
      <div
        className="absolute inset-y-0 right-0 bg-[var(--mark)]/5"
        style={{ left: `${threshold * 100}%` }}
      />
      {samples.map((s) => {
        const predicted = s.noul >= threshold
        const wrong = predicted !== s.truth
        return (
          <span
            key={s.id}
            title={`${s.label} — ${percent(s.noul, 0)}${s.truth ? " · relevant" : " · not"}`}
            className={cn(
              "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              wrong && "ring-2 ring-[var(--status-warning-ink)] ring-offset-1 ring-offset-[var(--surface)]",
            )}
            style={{
              left: `${s.noul * 100}%`,
              top: s.truth ? "34%" : "66%",
              backgroundColor: s.truth ? "var(--pole-true)" : "var(--pole-false)",
            }}
          />
        )
      })}
    </div>
  )
}

/** The confusion matrix and rates at the current threshold. */
export function MetricsPanel({
  metrics,
  fitted,
  guessed,
  onPick,
}: {
  metrics: Metrics
  fitted: number
  guessed: number
  onPick: (t: number) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">At {percent(metrics.threshold, 0)}</h4>
        <div className="ml-auto flex gap-1.5">
          <PickChip label={`fitted ${percent(fitted, 0)}`} onClick={() => onPick(fitted)} active={metrics.threshold === fitted} />
          <PickChip label={`guess ${percent(guessed, 0)}`} onClick={() => onPick(guessed)} active={metrics.threshold === guessed} />
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-[var(--hairline)] border-b border-[var(--hairline)] sm:grid-cols-4">
        <Stat label="precision" value={percent(metrics.precision, 0)} />
        <Stat label="recall" value={percent(metrics.recall, 0)} />
        <Stat label="F1" value={metrics.f1.toFixed(2)} emphasis />
        <Stat label="accuracy" value={percent(metrics.accuracy, 0)} />
      </dl>

      <dl className="grid grid-cols-4 divide-x divide-[var(--hairline)] text-center">
        <Confusion label="kept, right" value={metrics.tp} />
        <Confusion label="kept, wrong" value={metrics.fp} warn={metrics.fp > 0} />
        <Confusion label="dropped, wrong" value={metrics.fn} warn={metrics.fn > 0} />
        <Confusion label="dropped, right" value={metrics.tn} />
      </dl>
    </Card>
  )
}

function PickChip({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
        active
          ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
          : "border-[var(--hairline)] text-ink-secondary hover:text-ink",
      )}
    >
      {label}
    </button>
  )
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="px-3.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn("tabular mt-0.5 text-sm", emphasis ? "font-medium text-[var(--mark)]" : "text-ink")}>
        {value}
      </dd>
    </div>
  )
}

function Confusion({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="px-2 py-2">
      <dd className={cn("tabular text-sm font-medium", warn ? "text-[var(--status-warning-ink)]" : "text-ink")}>
        {value}
      </dd>
      <dt className="text-[10px] text-ink-muted">{label}</dt>
    </div>
  )
}

/**
 * F1 across every threshold on the grid, as bars, with the fit and the guess
 * marked. The peak is the fitted threshold; the guess is wherever 0.5 lands.
 */
export function F1Curve({
  points,
  fitted,
  guessed,
  current,
  onPick,
}: {
  points: Metrics[]
  fitted: number
  guessed: number
  current: number
  onPick: (t: number) => void
}) {
  const max = Math.max(...points.map((p) => p.f1), 0.0001)
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">F1 across every threshold</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          The peak is the fit. The dotted mark is the 0.5 a demo would guess.
        </p>
      </div>
      <div className="flex items-end gap-0.5 px-3.5 py-3" style={{ height: 120 }}>
        {points.map((p) => {
          const isFit = p.threshold === fitted
          const isGuess = p.threshold === guessed
          const isCurrent = p.threshold === current
          return (
            <button
              type="button"
              key={p.threshold}
              onClick={() => onPick(p.threshold)}
              title={`${percent(p.threshold, 0)} · F1 ${p.f1.toFixed(2)}`}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
            >
              <div
                className={cn(
                  "w-full rounded-sm transition-colors",
                  isFit
                    ? "bg-[var(--mark)]"
                    : isCurrent
                      ? "bg-[var(--ink-secondary)]"
                      : "bg-[var(--pole-neutral)] group-hover:bg-[var(--ink-muted)]",
                )}
                style={{ height: `${(p.f1 / max) * 100}%` }}
              />
              <span
                className={cn(
                  "text-[8px] tabular",
                  isGuess ? "font-medium text-ink" : "text-ink-muted",
                )}
              >
                {isFit ? "▲" : isGuess ? "·" : ""}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** The one-line result: what the fit buys over the guess. */
export function FitHeadline({ fitted, guessed }: { fitted: Metrics; guessed: Metrics }) {
  return (
    <Card>
      <div className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="mark" className="tabular">
            fitted {percent(fitted.threshold, 0)} · F1 {fitted.f1.toFixed(2)}
          </Badge>
          <Badge variant="outline" className="tabular">
            guess {percent(guessed.threshold, 0)} · F1 {guessed.f1.toFixed(2)}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-ink">
          Fitting the threshold against the labels cuts the guess's{" "}
          <span className="font-medium">{guessed.fp}</span> wrongly-kept chunks to{" "}
          <span className="font-medium text-[var(--mark)]">{fitted.fp}</span>, at the
          cost of {fitted.fn - guessed.fn} more dropped — a trade the labels, not a
          hunch, decide. No model was called to learn it.
        </p>
      </div>
    </Card>
  )
}
