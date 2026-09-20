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
  answers: Answers
  /** Null when the policy threw, or when there is no policy at all. */
  verdict: TVerdict | null
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
  /**
   * The gate a named answer must clear, shown on its confidence meter.
   *
   * A function of the answers because the gate frequently depends on them:
   * routing to billing demands more confidence than routing to support,
   * because only one of those branches can move money.
   */
  thresholdFor?: (name: string, answers: Answers) => number | undefined
  /** Heading above the answer column. Its job is to name the shape out loud. */
  answersTitle: string
  runLabel?: string
  /**
   * The input under judgement, rendered before anything has been asked.
   *
   * Separate from `children` so the thing being judged is on screen while the
   * request is still in flight, rather than the page sitting empty until an
   * answer lands.
   */
  preview?: (input: TInput) => ReactNode
  /** Rendered once answers land, above the policy trace: the bespoke view. */
  children?: (context: ScaffoldRender<TInput, TVerdict>) => ReactNode
}

/**
 * Everything every demo repeats, in one place.
 *
 * Before this there were eleven identical structural elements in each demo's
 * file — the frame, the run bar, the example chips, the error note, the
 * two-column grid, the answer list, the trace, the wire panel and the source
 * badges — wrapped around ten or twenty lines of the thing the demo was
 * actually for. A demo now supplies its manifest, its policy and its own view,
 * and nothing else.
 */
export function DemoScaffold<TInput, TVerdict extends PolicyResult>({
  manifest,
  run,
  policy,
  thresholdFor,
  answersTitle,
  runLabel = "Re-ask",
  preview,
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

  return (
    <DemoFrame demo={demo}>
      <RunBar
        examples={manifest.examples.map(({ id, label }) => ({ id, label }))}
        selected={run.selected}
        onSelect={run.select}
        onRun={run.run}
        loading={run.loading}
        runLabel={runLabel}
        latencyMs={run.latencyMs}
        usage={run.usage}
        calls={run.calls}
        source={run.source}
      />

      {run.error ? <ErrorNote message={run.error} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-4">
          {preview?.(run.input)}
          {answers ? children?.({ input: run.input, answers, verdict }) : null}
          {verdict ? <PolicyTrace lines={verdict.trace} /> : null}
          {run.wire ? <WirePanel wire={run.wire} /> : null}
        </div>

        <div className="min-w-0 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-muted">
            {answersTitle}
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
                    threshold={thresholdFor?.(name, answers)}
                  />
                )
              })
            : null}
        </div>
      </div>
    </DemoFrame>
  )
}
