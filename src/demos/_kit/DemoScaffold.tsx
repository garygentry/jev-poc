import { useMemo, type ReactNode } from "react"

import { AnswerCard } from "@/components/jev/AnswerCard"
import { PolicyTrace, type PolicyLine } from "@/components/jev/PolicyTrace"
import { WirePanel } from "@/components/jev/WirePanel"
import { DemoFrame } from "@/components/layout/DemoFrame"
import { ErrorNote, RunBar } from "@/components/layout/RunBar"
import { demoBySlug } from "@/demos/registry"

import type { RunEnvelope } from "./runners/types"
import type { DemoManifest } from "./types"

import type { JevAnswer } from "@shared/jev.ts"

type Answers = Record<string, JevAnswer>

/** What a demo's policy hands back: a verdict, plus the branches that fired. */
export interface PolicyResult {
  trace: PolicyLine[]
}

export interface ScaffoldRender<TInput, TVerdict> {
  input: TInput
  /** Null until something has run. The demo decides what to show meanwhile. */
  answers: Answers | null
  /** Null when there is no policy, nothing has run, or the policy threw. */
  verdict: TVerdict | null
  /** The measured figures, for the demos that report their own. */
  run: RunEnvelope<TInput>
}

/**
 * The answer column: one card per question, down the right-hand side.
 *
 * Only the demos that ask one question set of one state have this — a fan-out's
 * answers are per row and belong in whatever view that demo builds for them.
 * Passing it is what selects the two-column layout.
 */
export interface AnswerColumn {
  /** Heading above the column. Its job is to name the shape out loud. */
  title: string
  /**
   * The gate a named answer must clear, shown on its confidence meter.
   *
   * A function of the answers because the gate frequently depends on them:
   * routing to billing demands more confidence than routing to support,
   * because only one of those branches can move money.
   */
  thresholdFor?: (name: string, answers: Answers) => number | undefined
}

interface DemoScaffoldProps<TInput, TVerdict extends PolicyResult> {
  manifest: DemoManifest<TInput>
  run: RunEnvelope<TInput>
  /**
   * Answers in, verdict out — the pure function this demo exists to justify.
   *
   * Called here rather than in the demo so the trace it produces is always the
   * one rendered beside it, and cannot drift out of step with the branch that
   * actually fired.
   */
  policy?: (answers: Answers) => TVerdict
  answers?: AnswerColumn
  runLabel?: string
  /** Off for the demos whose input is edited rather than picked from a list. */
  showExamples?: boolean
  /** Off for the one demo that needs a control the run bar cannot express. */
  showRunBar?: boolean
  /** Above the run bar: an editor, or controls the run bar has no room for. */
  before?: ReactNode
  /** Below the wire panel: the standing caveats a demo carries. */
  footer?: ReactNode
  children?: (context: ScaffoldRender<TInput, TVerdict>) => ReactNode
}

/**
 * Everything every demo repeats, in one place.
 *
 * The frame, the run bar, the example chips, the error note and the wire panel
 * are common to all eight; the two-column grid, the answer cards and the policy
 * trace are common to the demos that ask one question set of one state, and
 * arrive together as `answers`. Everything past that is the demo's own, which
 * is the point: a fan-out's view of twenty-four ranked rows has nothing to
 * share with a permission gate beyond the chrome around it.
 */
export function DemoScaffold<TInput, TVerdict extends PolicyResult>({
  manifest,
  run,
  policy,
  answers: answerColumn,
  runLabel = "Re-ask",
  showExamples = true,
  showRunBar = true,
  before,
  footer,
  children,
}: DemoScaffoldProps<TInput, TVerdict>) {
  const demo = demoBySlug(manifest.slug)!
  const { answers } = run

  const verdict = useMemo(() => {
    if (!answers || !policy) return null
    try {
      return policy(answers)
    } catch {
      // A policy that throws means the answers were not the shape it requires —
      // a question renamed, or a fixture from an older question set. The
      // answers themselves are still worth showing, so the verdict is dropped
      // rather than the page.
      return null
    }
  }, [answers, policy])

  const body = children?.({ input: run.input, answers, verdict, run })

  return (
    <DemoFrame demo={demo}>
      {before}

      {showRunBar ? (
        <RunBar
          examples={
            showExamples
              ? manifest.examples.map(({ id, label }) => ({ id, label }))
              : undefined
          }
          selected={run.selected ?? undefined}
          onSelect={run.select}
          onRun={run.run}
          loading={run.loading}
          runLabel={runLabel}
          latencyMs={run.latencyMs}
          usage={run.usage}
          calls={run.calls}
          source={run.source}
        />
      ) : null}

      {run.error ? <ErrorNote message={run.error} /> : null}

      {answerColumn ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="min-w-0 space-y-4">
            {body}
            {verdict ? <PolicyTrace lines={verdict.trace} /> : null}
            {run.wire ? <WirePanel wire={run.wire} /> : null}
          </div>

          <div className="min-w-0 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-ink-muted">
              {answerColumn.title}
            </h3>
            {answers
              ? Object.entries(manifest.questions).map(([name, question]) => {
                  const answer = answers[name]
                  if (!answer) return null
                  return (
                    <AnswerCard
                      key={name}
                      name={name}
                      question={question}
                      answer={answer}
                      threshold={answerColumn.thresholdFor?.(name, answers)}
                    />
                  )
                })
              : null}
          </div>
        </div>
      ) : (
        <>
          {body}
          {run.wire ? <WirePanel wire={run.wire} /> : null}
        </>
      )}

      {footer}
    </DemoFrame>
  )
}
