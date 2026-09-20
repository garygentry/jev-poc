import { cn } from "@/lib/utils"
import { ms, usd } from "@/lib/format"

import type { Displacement as DisplacementSpec } from "@/demos/_kit/types"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

interface DisplacementProps {
  /** The stated assumption this run is measured against. */
  displaces: DisplacementSpec
  /** Measured spend for this run. */
  usage?: JevUsage
  /** Measured round trip or wall-clock for this run. */
  latencyMs?: number
  /** Upstream calls this run actually made. */
  calls?: number
  source?: AnswerSource
  /**
   * How many baseline units this run displaced.
   *
   * Only the demo knows whether a run stands in for one request or twenty-four
   * rows, so it passes the count rather than the card guessing it. The baseline
   * cost is `baselineUsd × units`; the ratio falls out of that against the
   * measured spend.
   */
  units?: number
  className?: string
}

/**
 * The cost story, told the same way every time.
 *
 * Three rows that are never conflated: what this run measured, what the same
 * work is assumed to cost today, and the ratio between them — labelled as
 * resting on the assumption. The middle row is a *stated* number with its
 * source inline, so a ratio can never be read without the figure it rests on.
 *
 * Nothing renders unless the answers were live: a replayed fixture spent no
 * money, so a measured comparison against it would be inventing one.
 */
export function Displacement({
  displaces,
  usage,
  latencyMs,
  calls,
  source,
  units = 1,
  className,
}: DisplacementProps) {
  if (source !== "live" || !usage) return null

  const baselineCost = displaces.baselineUsd * units
  const measuredCost = usage.cost
  const ratio = measuredCost > 0 ? baselineCost / measuredCost : null

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">Cost displaced</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Measured against a stated baseline. The ratio holds only if that
          assumption does.
        </p>
      </div>

      <dl className="divide-y divide-[var(--hairline)]">
        <Row label="This run" measured>
          <span className="tabular text-ink">{usd(measuredCost)}</span>
          {latencyMs !== undefined ? (
            <span className="tabular text-ink-muted">{ms(latencyMs)}</span>
          ) : null}
          {calls !== undefined ? (
            <span className="text-ink-muted">
              {calls} {calls === 1 ? "call" : "calls"}
            </span>
          ) : null}
        </Row>

        <Row label="The same work today">
          <span className="tabular text-ink">{usd(baselineCost)}</span>
          <span className="text-ink-muted">{displaces.baseline}</span>
        </Row>

        <div className="px-3.5 py-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
            Ratio
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {ratio !== null ? (
              <span className="tabular text-sm font-medium text-[var(--mark)]">
                {ratio >= 1
                  ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× cheaper`
                  : `${(1 / ratio).toFixed(1)}× dearer`}
              </span>
            ) : (
              <span className="text-sm text-ink-muted">
                no measured cost to compare
              </span>
            )}
            <span className="text-[11px] text-ink-muted">
              if the assumption below holds
            </span>
          </dd>
        </div>
      </dl>

      <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        Baseline: {displaces.source}
      </p>
    </div>
  )
}

/** One labelled row of measured or assumed figures. */
function Row({
  label,
  measured,
  children,
}: {
  label: string
  measured?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="px-3.5 py-2.5">
      <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
        {measured ? (
          <span className="text-[10px] normal-case text-ink-muted/80">
            measured
          </span>
        ) : (
          <span className="text-[10px] normal-case text-ink-muted/80">
            stated assumption
          </span>
        )}
      </dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        {children}
      </dd>
    </div>
  )
}
