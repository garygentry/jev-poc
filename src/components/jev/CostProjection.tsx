import { Calculator } from "lucide-react"

import { cn } from "@/lib/utils"
import { usd } from "@/lib/format"
import { projectJevSpend } from "@shared/jev.ts"

/**
 * What clicking would spend, shown before a fan-out runs.
 *
 * The one shape in this app whose cost grows with its input says so up front,
 * so nobody learns the size of a run from the bill. It is explicitly a
 * *projection* — dated list price over a blunt per-call token estimate — and
 * the measured figures replace it the moment the run is real, per the rule that
 * prices are only ever used to project.
 */
export function CostProjection({
  calls,
  className,
}: {
  calls: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "tabular flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-[var(--hairline)] px-3 py-2 text-xs text-ink-secondary",
        className,
      )}
    >
      <Calculator className="size-3.5 text-ink-muted" aria-hidden />
      <span className="text-ink">
        ~{calls} {calls === 1 ? "call" : "calls"}
      </span>
      <span className="text-ink-muted">·</span>
      <span className="text-ink">~{usd(projectJevSpend(calls))}</span>
      <span className="text-ink-muted">projected if run live</span>
    </div>
  )
}
