import { Check, Loader2, Search as SearchIcon, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ms, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import { REGEX, RULE } from "./corpus"
import { MATCH_THRESHOLD, type Classified } from "./policy"

/** The rule in English, and the regex someone tried to write for it. */
export function RuleCard() {
  return (
    <Card>
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">The rule</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{RULE}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            The regex someone tried
          </p>
          <code className="mt-1 block font-mono text-xs text-ink-secondary">
            {String(REGEX)}
          </code>
        </div>
      </div>
    </Card>
  )
}

/**
 * The functions, with Jev's match beside the regex's — disagreements named.
 *
 * The point is where they differ: the regex flags a call that sets a timeout it
 * cannot see, or misses one written with a library it was not told about. Those
 * rows are marked so the failure of the pattern is legible, not buried.
 */
export function Results({
  classified,
  usage,
  wallClockMs,
  calls,
  source,
  loading,
}: {
  classified: Classified[]
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
  loading: boolean
}) {
  const jevHits = classified.filter((c) => c.jev).length
  const regexHits = classified.filter((c) => c.regex).length
  const falseMatches = classified.filter((c) => c.disagreement === "false-match").length
  const misses = classified.filter((c) => c.disagreement === "miss").length
  const live = source === "live"

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <SearchIcon className="size-3.5 text-ink-muted" aria-hidden />
        <h4 className="text-xs font-medium text-ink">
          Jev matched {jevHits}, the regex matched {regexHits}
        </h4>
        {loading ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-ink-muted" aria-hidden />
        ) : null}
      </div>

      <ul className="divide-y divide-[var(--hairline)]">
        {classified.map((c) => (
          <li key={c.fn.id} className="px-3.5 py-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-ink">{c.fn.name}</span>
              <Hit label="Jev" on={c.jev} />
              <Hit label="regex" on={c.regex} muted />
              {c.disagreement === "false-match" ? (
                <Badge variant="warning" className="ml-auto text-[10px]">
                  regex false match
                </Badge>
              ) : c.disagreement === "miss" ? (
                <Badge variant="warning" className="ml-auto text-[10px]">
                  regex missed it
                </Badge>
              ) : null}
            </div>
            <pre className="overflow-x-auto rounded-md border border-[var(--hairline)] bg-[var(--mark)]/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-secondary">
              {c.fn.code}
            </pre>
            {c.probability !== null ? (
              <NoulGauge
                label="matches the rule"
                value={c.probability}
                threshold={MATCH_THRESHOLD}
                className="mt-2"
              />
            ) : null}
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--hairline)] px-3.5 py-2 text-[11px] text-ink-muted">
        The regex made {falseMatches} false match{falseMatches === 1 ? "" : "es"} on
        calls that set a timeout, and missed {misses} written with a library it did
        not know.
        {live && usage ? (
          <>
            {" "}Jev judged {calls ?? 0} functions for{" "}
            <span className="tabular text-ink">{usd(usage.cost)}</span>
            {wallClockMs !== undefined ? (
              <span className="tabular"> in {ms(wallClockMs)}</span>
            ) : null}{" "}
            <span className="text-[10px]">measured</span>.
          </>
        ) : (
          <> Jev's measured cost shows on a live run.</>
        )}
      </div>
    </Card>
  )
}

function Hit({ label, on, muted }: { label: string; on: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px]",
        on
          ? muted
            ? "text-ink-secondary"
            : "text-[var(--mark)]"
          : "text-ink-muted",
      )}
    >
      {on ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
      {label}
    </span>
  )
}
