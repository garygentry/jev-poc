import { Ban, Check, Flag, Loader2, Repeat, Scissors } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { NoulGauge } from "@/components/jev/NoulGauge"
import { ms, usd } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { AnswerSource, JevUsage } from "@shared/jev.ts"

import type { Trace } from "./trace"
import { MAX_ITERATIONS, STUCK_THRESHOLD, type LoopReport, type WindowVerdict } from "./policy"

/** What the agent is working toward — every window is judged against it. */
export function GoalCard({ goal }: { goal: string }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">The goal</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{goal}</p>
      </div>
    </Card>
  )
}

/**
 * The verdict, told against the counter it replaces.
 *
 * The step counts are deterministic and need no key — a loop's onset and the
 * cap are both just step numbers. Jev's own measured cost is shown only against
 * a live run, because a replayed fan-out spent nothing.
 */
export function Verdict({
  report,
  usage,
  wallClockMs,
  calls,
  source,
}: {
  report: LoopReport
  usage?: JevUsage
  wallClockMs?: number
  calls?: number
  source?: AnswerSource
}) {
  const { looping, onsetStep, totalSteps, counterEnd, stepsSaved, falseCut } = report
  const live = source === "live"

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] px-3.5 py-3">
        {looping ? (
          <Badge variant="warning" className="gap-1">
            <Repeat aria-hidden />
            loop — circling from step {onsetStep}
          </Badge>
        ) : falseCut ? (
          <Badge variant="mark" className="gap-1">
            <Check aria-hidden />
            still advancing at step {totalSteps}
          </Badge>
        ) : (
          <Badge variant="mark" className="gap-1">
            <Check aria-hidden />
            no loop — finished in {totalSteps} steps
          </Badge>
        )}
      </div>

      <div className="px-3.5 py-3">
        {looping ? (
          <p className="text-sm leading-relaxed text-ink">
            The detector stops it at step{" "}
            <span className="font-medium">{onsetStep}</span>. A max-iteration
            counter (cap {MAX_ITERATIONS}) counts blindly to step{" "}
            <span className="font-medium">{counterEnd}</span> —{" "}
            <span className="font-medium text-[var(--mark)]">
              {stepsSaved} step{stepsSaved === 1 ? "" : "s"}
            </span>{" "}
            of circling it lets burn that the detector never pays for.
          </p>
        ) : falseCut ? (
          <p className="text-sm leading-relaxed text-ink">
            The run never circles — every window keeps advancing. A counter capped
            at {MAX_ITERATIONS} would cut it{" "}
            <span className="font-medium text-[var(--status-warning-ink)]">
              {totalSteps - MAX_ITERATIONS} step
              {totalSteps - MAX_ITERATIONS === 1 ? "" : "s"} short
            </span>{" "}
            of the work it was about to finish.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink">
            No streak of circling, and the run ends within the cap — here the
            detector and a counter agree. They only disagree when a run is long
            but working, or short but stuck.
          </p>
        )}

        {live && usage ? (
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-ink-muted">
            <span className="uppercase tracking-wide">Jev read the trace for</span>
            <span className="tabular text-ink">{usd(usage.cost)}</span>
            {wallClockMs !== undefined ? (
              <span className="tabular">{ms(wallClockMs)}</span>
            ) : null}
            {calls !== undefined ? <span>{calls} windows</span> : null}
            <span className="text-[10px]">measured</span>
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-ink-muted">
            The step counts are exact and need no key. Jev's measured cost for
            reading the trace appears against a live run.
          </p>
        )}
      </div>
    </Card>
  )
}

/**
 * The trace, step by step, with each window's circling read attached to the step
 * it starts on and the loop region shaded.
 *
 * Every step but the last two is the leading edge of a window, so its gauge
 * answers "are the next three steps from here circling?" — and a real loop reads
 * as a run of full gauges, with the counter's blind cut marked across it.
 */
export function Timeline({
  trace,
  report,
  loading,
}: {
  trace: Trace
  report: LoopReport | null
  loading: boolean
}) {
  const byStart = new Map<number, WindowVerdict>(
    (report?.windows ?? []).map((w) => [w.startStep, w]),
  )
  const onset = report?.onsetStep ?? null
  const showCap = trace.steps.length > MAX_ITERATIONS

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3.5 py-2.5">
        <Repeat className="size-3.5 text-ink-muted" aria-hidden />
        <h4 className="text-xs font-medium text-ink">The trace, window by window</h4>
        {loading ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-ink-muted" aria-hidden />
        ) : null}
      </div>

      <ol className="divide-y divide-[var(--hairline)]">
        {trace.steps.map((step, i) => {
          const n = i + 1
          const window = byStart.get(n)
          const inLoop = onset !== null && n >= onset
          return (
            <li key={n}>
              {onset === n ? <Marker kind="onset" /> : null}
              <div
                className={cn(
                  "px-3.5 py-2.5",
                  inLoop && "border-l-2 border-[var(--status-warning-ink)]/50 bg-[var(--status-warning-ink)]/5",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-[11px] text-ink-muted">{n}</span>
                  <span className="text-xs text-ink">{step.action}</span>
                </div>
                <p className="mt-0.5 pl-5 text-[11px] leading-relaxed text-ink-secondary">
                  → {step.result}
                </p>
                {window && window.probability !== null ? (
                  <div className="mt-2 pl-5">
                    <NoulGauge
                      label={`steps ${n}–${n + 2} circling`}
                      value={window.probability}
                      threshold={STUCK_THRESHOLD}
                    />
                  </div>
                ) : null}
              </div>
              {showCap && n === MAX_ITERATIONS ? <Marker kind="cap" /> : null}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/** A labelled divider on the timeline: where the loop began, or where a counter cuts. */
function Marker({ kind }: { kind: "onset" | "cap" }) {
  const onset = kind === "onset"
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-medium",
        onset
          ? "bg-[var(--status-warning-ink)]/10 text-[var(--status-warning-ink)]"
          : "bg-[var(--ink-muted)]/10 text-ink-muted",
      )}
    >
      {onset ? (
        <Flag className="size-3.5" aria-hidden />
      ) : (
        <Scissors className="size-3.5" aria-hidden />
      )}
      {onset
        ? "Loop detected — circling from here"
        : `A max-iteration counter (cap ${MAX_ITERATIONS}) stops here, regardless`}
      {!onset ? <Ban className="ml-auto size-3.5" aria-hidden /> : null}
    </div>
  )
}
