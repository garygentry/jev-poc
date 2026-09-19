import { cn } from "@/lib/utils"
import { humanize, percent } from "@/lib/format"

interface ProbabilityBarProps {
  label: string
  probability: number
  /** The winning option carries the emphasised mark; the rest recede. */
  emphasised?: boolean
  /** Level description for a Score rung, shown under the label. */
  caption?: string
  className?: string
}

/**
 * One row of a distribution: label, track, value.
 *
 * Magnitude is carried by bar length. Color only separates the leading option
 * from the rest, so the reader is never asked to decode a hue into a number.
 * The value is direct-labelled on every row because a distribution is short
 * enough that all of them fit.
 */
export function ProbabilityBar({
  label,
  probability: value,
  emphasised = false,
  caption,
  className,
}: ProbabilityBarProps) {
  const width = Math.max(0, Math.min(1, value)) * 100

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3", className)}>
      <div className="min-w-0">
        <span
          className={cn(
            "block truncate text-xs capitalize",
            emphasised ? "font-medium text-ink" : "text-ink-secondary",
          )}
        >
          {humanize(label)}
        </span>
      </div>
      <span
        className={cn(
          "tabular text-xs",
          emphasised ? "font-medium text-ink" : "text-ink-muted",
        )}
      >
        {percent(value, 1)}
      </span>

      <div className="col-span-2 mt-1 h-1.5 w-full rounded-full bg-[var(--gridline)]">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: emphasised
              ? "var(--mark)"
              : "var(--mark-recessive)",
            opacity: emphasised ? 1 : 0.55,
          }}
        />
      </div>

      {caption ? (
        <p className="col-span-2 mt-1 text-[11px] leading-snug text-ink-muted">
          {caption}
        </p>
      ) : null}
    </div>
  )
}
