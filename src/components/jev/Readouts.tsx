import { Database, Gauge, Radio, Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ms, tokens, usd } from "@/lib/format"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

/**
 * Measured round trip for one call.
 *
 * Replayed answers show no figure at all rather than a zero, because there was
 * no round trip to measure and printing one would be inventing it.
 */
export function LatencyBadge({
  latencyMs,
  replayed,
  className,
}: {
  latencyMs: number
  replayed: boolean
  className?: string
}) {
  if (replayed) return null
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1.5 text-xs text-ink-secondary",
        className,
      )}
    >
      <Timer className="size-3.5 text-ink-muted" aria-hidden />
      {ms(latencyMs)}
    </span>
  )
}

/** Tokens and cost for one call or one run, straight from `usage`. */
export function UsageReadout({
  usage,
  calls,
  className,
}: {
  usage: JevUsage
  calls?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-3 text-xs text-ink-secondary",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Database className="size-3.5 text-ink-muted" aria-hidden />
        {tokens(usage.input_tokens)} in
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Gauge className="size-3.5 text-ink-muted" aria-hidden />
        {usd(usage.cost)}
      </span>
      {calls !== undefined ? (
        <span className="text-ink-muted">
          {calls} {calls === 1 ? "call" : "calls"}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Where an answer came from.
 *
 * Live answers need no badge; anything replayed is labelled, and the two
 * replay kinds are distinguished because they are not equally meaningful —
 * a seeded fixture is a plausible answer, a synthetic one is shaped noise.
 */
export function SourceBadge({ source }: { source: AnswerSource }) {
  if (source === "live") return null

  if (source === "seeded") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Radio className="text-ink-muted" aria-hidden />
        Seeded fixture
      </Badge>
    )
  }

  return (
    <Badge variant="warning" className="gap-1.5">
      <Radio aria-hidden />
      Synthetic — not a real judgement
    </Badge>
  )
}
