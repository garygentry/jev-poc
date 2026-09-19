import { cn } from "@/lib/utils"
import { percent } from "@/lib/format"

interface NoulGaugeProps {
  label: string
  /** Probability the proposition holds, 0–1. */
  value: number
  /** Optional decision gate, drawn as a tick on the track. */
  threshold?: number
  className?: string
}

/**
 * A noul, drawn as a diverging track rather than a checkbox.
 *
 * 0.5 is the meaningful centre: it is genuine uncertainty, not "half true", and
 * a binary tick would throw that away. The fill runs from the midpoint toward
 * whichever pole the answer leans to, so the length reads as *how far from a
 * coin flip* rather than as a magnitude from zero.
 *
 * The lean is always spelled out in words beside the color — likely, unlikely,
 * or uncertain — so the direction never depends on hue alone.
 */
export function NoulGauge({ label, value, threshold, className }: NoulGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const leansTrue = clamped >= 0.5
  const distance = Math.abs(clamped - 0.5)
  const uncertain = distance < 0.1

  const lean = uncertain ? "uncertain" : leansTrue ? "likely" : "unlikely"
  const color = uncertain
    ? "var(--ink-muted)"
    : leansTrue
      ? "var(--pole-true)"
      : "var(--pole-false)"

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-ink-secondary">{label}</span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="tabular text-xs font-medium text-ink">
            {percent(clamped, 1)}
          </span>
          <span className="text-[11px] lowercase" style={{ color }}>
            {lean}
          </span>
        </span>
      </div>

      <div className="relative h-1.5 w-full rounded-full bg-[var(--pole-neutral)]">
        {/* The neutral midpoint, drawn so 0.5 is visibly the origin. */}
        <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--axis)]" />
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-300 ease-out"
          style={{
            left: leansTrue ? "50%" : `${clamped * 100}%`,
            width: `${distance * 100}%`,
            backgroundColor: color,
          }}
        />
        {threshold !== undefined ? (
          <span
            className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-[var(--ink-secondary)]"
            style={{ left: `calc(${threshold * 100}% - 1px)` }}
            aria-label={`Gate at ${percent(threshold, 0)}`}
          />
        ) : null}
      </div>
    </div>
  )
}
