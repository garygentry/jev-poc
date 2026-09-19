import { Loader2, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LatencyBadge, SourceBadge, UsageReadout } from "@/components/jev/Readouts"
import { cn } from "@/lib/utils"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

export interface ExampleOption {
  id: string
  label: string
}

/**
 * Example chips, a run control, and the readouts for whatever just ran.
 *
 * Shared by every demo so the measured figures always appear in the same place
 * and read the same way.
 */
export function RunBar({
  examples,
  selected,
  onSelect,
  onRun,
  loading,
  runLabel = "Ask Jev",
  latencyMs,
  usage,
  calls,
  source,
  className,
}: {
  examples?: ExampleOption[]
  selected?: string
  onSelect?: (id: string) => void
  onRun: () => void
  loading: boolean
  runLabel?: string
  latencyMs?: number
  usage?: JevUsage
  calls?: number
  source?: AnswerSource
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {examples?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => onSelect?.(example.id)}
              aria-pressed={selected === example.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                selected === example.id
                  ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                  : "border-[var(--hairline)] text-ink-secondary hover:border-[var(--mark)]/40 hover:text-ink",
              )}
            >
              {example.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Play />}
          {loading ? "Asking…" : runLabel}
        </Button>

        {/*
          Measured figures appear only when the model actually answered. A
          replayed fixture carries a cost and a token count, but no call was
          made and no money was spent — printing them beside a "seeded" badge
          would still invite reading them as this run's numbers.
        */}
        {source === "live" ? (
          <>
            {latencyMs !== undefined ? (
              <LatencyBadge latencyMs={latencyMs} replayed={false} />
            ) : null}
            {usage ? <UsageReadout usage={usage} calls={calls} /> : null}
          </>
        ) : null}
        {source ? <SourceBadge source={source} /> : null}
      </div>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="panel border-[var(--status-critical)]/40 bg-[var(--status-critical)]/5 p-3.5">
      <p className="text-sm text-ink">
        <span className="font-medium text-[var(--status-critical-ink)]">
          Request failed
        </span>{" "}
        — {message}
      </p>
    </div>
  )
}
