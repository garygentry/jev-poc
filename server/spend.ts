import type { JevUsage } from "@shared/jev.ts"

export interface Spend extends JevUsage {
  calls: number
}

/**
 * Cumulative usage for this server process, powering the header meter.
 *
 * In-process and deliberately not persisted: it answers "what has this session
 * cost me", and it resets when the server does. Every figure in it comes from
 * an upstream `usage` block — nothing here is estimated.
 */
const spend: Spend = { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 }

export function record(usage: JevUsage | undefined): void {
  if (!usage) return
  spend.calls += 1
  spend.input_tokens += usage.input_tokens ?? 0
  spend.output_tokens += usage.output_tokens ?? 0
  spend.cost += usage.cost ?? 0
}

export function snapshot(): Spend {
  return { ...spend }
}

export function reset(): void {
  spend.calls = 0
  spend.input_tokens = 0
  spend.output_tokens = 0
  spend.cost = 0
}

/** Sum a set of per-item usages into one, for a batch's aggregate line. */
export function sumUsage(usages: Array<JevUsage | undefined>): JevUsage {
  return usages.reduce<JevUsage>(
    (total, usage) => ({
      input_tokens: total.input_tokens + (usage?.input_tokens ?? 0),
      output_tokens: total.output_tokens + (usage?.output_tokens ?? 0),
      cost: total.cost + (usage?.cost ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, cost: 0 },
  )
}
