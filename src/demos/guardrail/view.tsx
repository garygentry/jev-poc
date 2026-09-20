import { CircleSlash, HelpCircle, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { WORKING_DIRECTORY } from "./demo"
import { RADIUS_POLICY, rule, type Verdict } from "./policy"

import type { JevAnswer } from "@shared/jev.ts"

/** The command about to run, shown before anything has judged it. */
export function CommandCard({ command }: { command: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          About to run in {WORKING_DIRECTORY}
        </p>
        <pre className="mt-2 overflow-x-auto font-mono text-sm text-ink">
          $ {command}
        </pre>
      </div>
    </Card>
  )
}

/**
 * `mark` is the filled/border colour; `ink` is the same hue stepped for text.
 * On the light surface the mark steps for warning and serious fall below 3:1 by
 * design — fine for a chip, unreadable as a word.
 */
const VERDICT_STYLE: Record<
  Verdict,
  { label: string; mark: string; ink: string; Icon: typeof ShieldCheck }
> = {
  allow: {
    label: "Allow",
    mark: "var(--status-good)",
    ink: "var(--status-good-ink)",
    Icon: ShieldCheck,
  },
  ask: {
    label: "Ask first",
    mark: "var(--status-warning)",
    ink: "var(--status-warning-ink)",
    Icon: HelpCircle,
  },
  deny: {
    label: "Refuse",
    mark: "var(--status-critical)",
    ink: "var(--status-critical-ink)",
    Icon: CircleSlash,
  },
}

export function VerdictCard({ ruling }: { ruling: ReturnType<typeof rule> }) {
  const { label, mark, ink, Icon } = VERDICT_STYLE[ruling.verdict]

  return (
    <Card style={{ borderColor: `color-mix(in srgb, ${mark} 35%, transparent)` }}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {/* Icon and word alongside the color: the status never reads on hue. */}
        <Icon className="mt-0.5 size-5 shrink-0" style={{ color: ink }} aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: ink }}>
            {label}
          </p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {ruling.reason}
          </p>
          {ruling.flags.length ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {ruling.flags.map((flag) => (
                <Badge key={flag} variant="outline" className="capitalize">
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/**
 * The gate table, shown because it is the argument the demo is making.
 *
 * Seeing `read_only` and `catastrophic` demand different things of the same
 * confidence number is more convincing than reading a sentence about it.
 */
export function GateTable({ selected }: { selected?: JevAnswer }) {
  const current = selected?.type === "choice" ? selected.choice : undefined

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--hairline)] px-4 py-2.5 sm:px-5">
        <h4 className="text-xs font-medium text-ink">
          Confidence needed to auto-allow
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          Scaled to what being wrong would cost, not set once for everything.
        </p>
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {Object.entries(RADIUS_POLICY).map(([radius, policy]) => (
          <li
            key={radius}
            className={cn(
              "flex items-center gap-3 px-4 py-2 text-sm sm:px-5",
              current === radius && "bg-[var(--mark)]/10",
            )}
          >
            <span
              className={cn(
                "font-mono text-xs capitalize",
                current === radius ? "text-ink" : "text-ink-secondary",
              )}
            >
              {radius.replace(/_/g, " ")}
            </span>
            <span className="tabular ml-auto text-xs">
              {"allowAt" in policy ? (
                <span className="text-ink">
                  {Math.round(policy.allowAt * 100)}%
                </span>
              ) : policy.never === "ask" ? (
                <span className="text-[var(--status-warning-ink)]">always asks</span>
              ) : (
                <span className="text-[var(--status-critical-ink)]">refused</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
