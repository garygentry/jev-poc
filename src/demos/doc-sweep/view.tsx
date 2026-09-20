import { Check, FileSearch, Loader2, ScanText, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ms, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import { TOPIC, WINDOW, type Document } from "./document"
import { DISCLOSE_THRESHOLD, type Sweep } from "./policy"

/** The document being swept, and the one question it is swept for. */
export function TopicCard({ doc }: { doc: Document }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Sweeping {doc.paragraphs.length} sections for whether
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{TOPIC}.</p>
      </div>
    </Card>
  )
}

/**
 * The document-level answer, then the honest catch, then the measured cost.
 *
 * The verdict aggregates the chunk hits; the count of paragraphs to read is the
 * real saving over the whole document. The measured cost shows only against a
 * live run, since a replayed fan-out spent nothing.
 */
export function Verdict({
  sweep,
  doc,
  usage,
  wallClockMs,
  calls,
  source,
}: {
  sweep: Sweep
  doc: Document
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
}) {
  const hitChunks = sweep.chunks.filter((c) => c.hit).length
  const toRead = sweep.matchingParagraphs.size
  const live = source === "live"

  return (
    <Card>
      <div className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {sweep.found ? (
            <Badge variant="warning" className="gap-1">
              <Check aria-hidden />
              found — the policy discloses this
            </Badge>
          ) : (
            <Badge variant="mark" className="gap-1">
              <X aria-hidden />
              not found in the document
            </Badge>
          )}
          {sweep.found ? (
            <span className="text-[11px] text-ink-muted">
              in {hitChunks} of {sweep.chunks.length} chunks — {toRead} of{" "}
              {doc.paragraphs.length} sections worth reading
            </span>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted">
          What chunking costs: each chunk is judged on its own {WINDOW} sections,
          without the pages around it. Overlap catches a disclosure that straddles
          a boundary; a clause that leans on a definition elsewhere is still read
          without it.
          {live && usage ? (
            <>
              {" "}The sweep read {calls ?? sweep.chunks.length} chunks for{" "}
              <span className="tabular text-ink">{usd(usage.cost)}</span>
              {wallClockMs !== undefined ? (
                <span className="tabular"> in {ms(wallClockMs)}</span>
              ) : null}{" "}
              <span className="text-[10px]">measured</span>, never loading the whole
              document at once.
            </>
          ) : (
            <> Jev's measured cost shows on a live run.</>
          )}
        </p>
      </div>
    </Card>
  )
}

/**
 * The chunks in document order, overlapping, each with its own read.
 *
 * Rendering the windows as they were judged — sharing a section at each boundary
 * — is what makes the sweep legible: the overlap is visible, and the one or two
 * chunks that carry the disclosure stand out from the quiet run around them.
 */
export function ChunkSweep({ sweep, loading }: { sweep: Sweep; loading: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <ScanText className="size-3.5 text-ink-muted" aria-hidden />
        <h4 className="text-xs font-medium text-ink">The document, chunk by chunk</h4>
        {loading ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-ink-muted" aria-hidden />
        ) : null}
      </div>
      <ul className="divide-y divide-[var(--hairline)]">
        {sweep.chunks.map(({ chunk, probability, hit }) => (
          <li key={chunk.id} className={cn("px-3.5 py-3", hit && "bg-[var(--status-warning-ink)]/5")}>
            <div className="mb-1.5 flex items-center gap-2">
              <FileSearch className="size-3.5 text-ink-muted" aria-hidden />
              <span className="text-[11px] text-ink-secondary">
                {chunk.paragraphs.map((p) => p.heading.replace(/^\d+\.\s*/, "")).join(" · ")}
              </span>
              {hit ? (
                <Badge variant="warning" className="ml-auto text-[9px]">
                  disclosure
                </Badge>
              ) : null}
            </div>
            {probability !== null ? (
              <NoulGauge label="discloses the topic" value={probability} threshold={DISCLOSE_THRESHOLD} />
            ) : (
              <p className="text-[11px] text-ink-muted">unanswered</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
