import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { percent } from "@/lib/format"
import { UNDECIDED_FLOOR } from "@shared/jev.ts"

interface ConfidenceMeterProps {
  confidence: number
  /** The gate this answer must clear to be acted on, drawn as a tick. */
  threshold?: number
  /** Below this, the distribution is flat and the answer means nothing. */
  undecidedFloor?: number
  className?: string
}

/**
 * How concentrated a distribution is, on 0–1.
 *
 * The important state here is the bottom one. A confidence at or near zero is a
 * *flat* distribution — Jev reporting that it cannot distinguish between the
 * options — which is a different statement from a low-but-real answer. It gets
 * its own treatment rather than rendering as a short bar that invites reading
 * the top option anyway.
 */
export function ConfidenceMeter({
  confidence,
  threshold,
  undecidedFloor = UNDECIDED_FLOOR,
  className,
}: ConfidenceMeterProps) {
  const undecided = confidence <= undecidedFloor

  if (undecided) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 px-2.5 py-2",
          className,
        )}
      >
        <AlertTriangle
          className="mt-px size-3.5 shrink-0 text-[var(--status-warning-ink)]"
          aria-hidden
        />
        <p className="text-[11px] leading-snug text-ink-secondary">
          <span className="font-medium text-[var(--status-warning-ink)]">
            Cannot tell
          </span>{" "}
          — the distribution is flat ({percent(confidence, 1)}). This answer must
          not be acted on.
        </p>
      </div>
    )
  }

  const band =
    confidence >= 0.85
      ? "var(--status-good)"
      : confidence >= 0.6
        ? "var(--status-warning)"
        : "var(--status-serious)"
  const label =
    confidence >= 0.85 ? "high" : confidence >= 0.6 ? "moderate" : "low"

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          Confidence
        </span>
        <span className="tabular text-xs font-medium text-ink">
          {percent(confidence, 1)}{" "}
          <span className="font-normal text-ink-muted">{label}</span>
        </span>
      </div>

      <div className="relative h-1.5 w-full rounded-full bg-[var(--gridline)]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${confidence * 100}%`, backgroundColor: band }}
        />
        {threshold !== undefined ? (
          <span
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-[var(--ink-secondary)]"
            style={{ left: `calc(${threshold * 100}% - 1px)` }}
            title={`Gate: ${percent(threshold, 0)}`}
            aria-label={`Gate at ${percent(threshold, 0)}`}
          />
        ) : null}
      </div>

      {threshold !== undefined ? (
        <p className="text-[11px] text-ink-muted">
          Gate {percent(threshold, 0)} ·{" "}
          {confidence >= threshold ? "cleared" : "not cleared"}
        </p>
      ) : null}
    </div>
  )
}
