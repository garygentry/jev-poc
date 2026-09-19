import { cn } from "@/lib/utils"
import { ms } from "@/lib/format"

interface SparklineProps {
  /** Most recent last. Fewer than two points renders nothing. */
  values: number[]
  label?: string
  className?: string
}

/**
 * Latency over the last N calls, as one line.
 *
 * A single series, so no legend: the label names it. The axis is implicit and
 * the only annotated values are the latest reading and the observed range,
 * which is what you actually watch while typing.
 */
export function Sparkline({ values, label = "Latency", className }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div className={cn("h-10", className)} aria-hidden>
        <span className="text-[11px] text-ink-muted">
          {label} — collecting…
        </span>
      </div>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const latest = values[values.length - 1] as number

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      // 4pt of headroom top and bottom keeps the 2px stroke off the edges.
      const y = 36 - ((value - min) / span) * 28 - 4
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        <span className="tabular text-xs font-medium text-ink">{ms(latest)}</span>
      </div>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-10 w-full"
        role="img"
        aria-label={`${label}: latest ${ms(latest)}, range ${ms(min)} to ${ms(max)} over ${values.length} calls`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--mark)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="tabular text-[11px] text-ink-muted">
        {ms(min)}–{ms(max)} over {values.length} calls
      </p>
    </div>
  )
}
