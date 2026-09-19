import { cn } from "@/lib/utils"
import { percent } from "@/lib/format"

import type { ScoreAnswer } from "@shared/jev.ts"

interface ScoreRailProps {
  answer: ScoreAnswer
  /** The rubric, in case the response omitted its legend. */
  criteria?: string[]
  className?: string
}

/**
 * A score on its rubric, with the weighted mean pinned where it actually landed.
 *
 * Levels are **0-indexed**: three criteria means levels 0, 1 and 2, so a score
 * of 1.5 sits exactly between the middle and top rung. That in-between position
 * is the whole point of the primitive, so the pin is placed continuously rather
 * than snapped to the nearest level.
 */
export function ScoreRail({ answer, criteria, className }: ScoreRailProps) {
  const levels =
    criteria ??
    Object.keys(answer.legend ?? answer.probabilities)
      .map(Number)
      .sort((a, b) => a - b)
      .map((level) => answer.legend?.[String(level)] ?? `Level ${level}`)

  const top = Math.max(1, levels.length - 1)
  const position = (Math.max(0, Math.min(top, answer.score)) / top) * 100

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative pt-6">
        {/* The pin, carrying its own value so the number is never inferred. */}
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-300 ease-out"
          style={{ left: `${position}%` }}
        >
          <span className="tabular rounded bg-[var(--mark)] px-1.5 py-0.5 text-[11px] font-medium text-white">
            {answer.score.toFixed(2)}
          </span>
          <span className="mx-auto block h-1.5 w-px bg-[var(--mark)]" />
        </div>

        <div className="relative h-1.5 w-full rounded-full bg-[var(--gridline)]">
          <div
            className="h-full rounded-full bg-[var(--mark)] transition-[width] duration-300 ease-out"
            style={{ width: `${position}%` }}
          />
          {levels.map((_, level) => (
            <span
              key={level}
              className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--axis)]"
              style={{ left: `${(level / top) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <ol className="space-y-1.5">
        {levels.map((text, level) => {
          const share = answer.probabilities[String(level)] ?? 0
          return (
            <li key={level} className="flex items-start gap-2 text-[11px]">
              <span className="tabular mt-px w-3 shrink-0 text-ink-muted">
                {level}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-ink-secondary">
                {text}
              </span>
              <span className="tabular shrink-0 text-ink-muted">
                {percent(share, 1)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
