import { FileText, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ms, percent, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import type { Clause } from "./contract"
import { RISK_DIMENSIONS, SURFACE_THRESHOLD, type Assessment } from "./policy"

/** One clause with its assessment, in contract order. */
export interface Row {
  clause: Clause
  assessment: Assessment
}

/**
 * The saving, told as surfaced-of-total.
 *
 * The count is exact and needs no key — it is just how many clauses cleared a
 * threshold. Jev's measured cost for reading the whole contract is shown only
 * against a live run, since a replayed fan-out spent nothing.
 */
export function Summary({
  rows,
  usage,
  wallClockMs,
  calls,
  source,
}: {
  rows: Row[]
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
}) {
  const surfaced = rows.filter((r) => r.assessment.surfaced).length
  const total = rows.length
  const live = source === "live"

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-sm text-ink">
          <span className="font-medium text-[var(--mark)]">
            {surfaced} of {total} clauses
          </span>{" "}
          carry risk worth a close read. The other {total - surfaced} are
          boilerplate a reviewer can skim.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
          {live && usage ? (
            <>
              Jev read all {calls ?? total} clauses on four risk questions for{" "}
              <span className="tabular text-ink">{usd(usage.cost)}</span>
              {wallClockMs !== undefined ? (
                <span className="tabular"> in {ms(wallClockMs)}</span>
              ) : null}{" "}
              <span className="text-[10px]">measured</span> — against a lawyer
              reading every clause of every contract to find these four.
            </>
          ) : (
            <>
              The surfaced count is exact and needs no key. Jev's measured cost for
              reading the whole contract shows on a live run.
            </>
          )}
        </p>
      </div>
    </Card>
  )
}

/**
 * The N clauses × M risks matrix.
 *
 * Every clause and every cell is shown — the claim is that all of them were
 * read — but a cell over its threshold is lit and a surfaced clause is lifted
 * out of the quiet ones, so the eye lands on what a reviewer should.
 */
export function RiskMatrix({ rows, loading }: { rows: Row[]; loading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <FileText className="size-3.5 text-ink-muted" aria-hidden />
        <h4 className="text-xs font-medium text-ink">Every clause, on every risk</h4>
        {loading ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-ink-muted" aria-hidden />
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--hairline)] text-[10px] uppercase tracking-wide text-ink-muted">
              <th className="px-3.5 py-2 font-medium">Clause</th>
              {RISK_DIMENSIONS.map((d) => (
                <th key={d.key} className="px-2 py-2 text-right font-medium">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {rows.map(({ clause, assessment }) => (
              <tr
                key={clause.id}
                className={cn(assessment.surfaced && "bg-[var(--status-warning-ink)]/5")}
              >
                <td className="px-3.5 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs",
                        assessment.surfaced ? "font-medium text-ink" : "text-ink-secondary",
                      )}
                    >
                      {clause.heading}
                    </span>
                    {assessment.surfaced ? (
                      <Badge variant="warning" className="text-[9px]">
                        review
                      </Badge>
                    ) : null}
                  </div>
                </td>
                {assessment.cells.map((cell) => (
                  <td key={cell.key} className="px-2 py-2 text-right align-top">
                    {cell.probability === null ? (
                      <span className="text-[11px] text-ink-muted">—</span>
                    ) : (
                      <span
                        className={cn(
                          "tabular text-[11px]",
                          cell.over
                            ? "font-medium text-[var(--status-warning-ink)]"
                            : "text-ink-muted",
                        )}
                      >
                        {percent(cell.probability, 0)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        A cell is lit when it clears {percent(SURFACE_THRESHOLD, 0)}; a clause
        surfaces when any of its four do.
      </p>
    </Card>
  )
}
