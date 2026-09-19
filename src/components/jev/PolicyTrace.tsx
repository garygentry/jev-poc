import { cn } from "@/lib/utils"

export interface PolicyLine {
  /** Source text, rendered verbatim. */
  code: string
  /** True when this branch was evaluated and taken on the current input. */
  fired?: boolean
  /** Why it fired, shown inline to the right. */
  note?: string
}

interface PolicyTraceProps {
  lines: PolicyLine[]
  className?: string
}

/**
 * The routing policy as source, with the branches that fired highlighted.
 *
 * Policy lives in code rather than in the model: thresholds and escalation
 * rules are ordinary TypeScript that can be read, unit-tested, and changed
 * without re-running inference. Showing it beside the verdict is what makes
 * that claim checkable instead of asserted.
 */
export function PolicyTrace({ lines, className }: PolicyTraceProps) {
  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="border-b border-[var(--hairline)] px-3.5 py-2.5">
        <h4 className="text-xs font-medium text-ink">Policy</h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Plain TypeScript. Highlighted lines fired on this input.
        </p>
      </div>
      <div className="overflow-x-auto">
        <pre className="min-w-max font-mono text-[11px] leading-relaxed">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 border-l-2 px-3.5 py-0.5",
                line.fired
                  ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                  : "border-transparent text-ink-muted",
              )}
            >
              <code className="whitespace-pre">{line.code}</code>
              {line.note ? (
                <span className="ml-auto shrink-0 pl-4 text-[var(--mark)]">
                  {line.note}
                </span>
              ) : null}
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
