import { isNoul } from "@shared/jev.ts"
import type { JevAnswer } from "@shared/jev.ts"

import type { PolicyLine } from "@/components/jev/PolicyTrace"

/**
 * A window counts as circling only when the gate is clearly for it.
 *
 * Set above a coin flip on purpose: a single uncertain window should not start a
 * loop verdict, because the cost of a false stop is the same harm this demo
 * exists to avoid — cutting a run that was still working. Certainty is cheap to
 * demand here because a real loop produces a *run* of high answers, not one.
 */
export const STUCK_THRESHOLD = 0.6

/**
 * How many consecutive stuck windows before it is called a loop.
 *
 * A short stall an agent breaks out of on its own can light up a window or two —
 * `recovers` reinstalls the same package three times before it thinks to check
 * the venv, and the gate rightly calls those two windows circling. Three in a
 * row is a stall that has persisted across enough of the trace to be a loop, not
 * a hiccup. This is the single knob that separates `recovers` from `debug-loop`,
 * and it was set here by capturing both and reading where the streaks actually
 * fell — a 2 would have cut `recovers` as bluntly as the counter it replaces.
 */
export const STREAK = 3

/**
 * The max-iteration counter this demo is measured against — a typical hard cap
 * an agent loop is given. It stops every run at the same step, whatever the
 * steps say, which is exactly the blunt instrument the detector replaces.
 */
export const MAX_ITERATIONS = 10

/** One window's verdict: where it starts, how stuck the gate found it, and the call. */
export interface WindowVerdict {
  startStep: number
  /** Probability the window is circling, or null if it went unanswered. */
  probability: number | null
  stuck: boolean
}

export interface LoopReport {
  windows: WindowVerdict[]
  looping: boolean
  /** 1-based step where the loop began — the first step of the first streak. */
  onsetStep: number | null
  totalSteps: number
  /** How far a max-iteration counter lets this run go: the cap, or the natural end. */
  counterEnd: number
  /**
   * Steps the detector spares over the counter: the stretch a counter would let
   * a loop burn (or, on a run that ends before the cap, the tail after onset).
   */
  stepsSaved: number
  /** The counter cut a run that never actually looped — the false-stop harm. */
  falseCut: boolean
  trace: PolicyLine[]
}

const probabilityOf = (answer: JevAnswer | undefined): number | null =>
  answer && isNoul(answer) ? answer.noul : null

/** The window index where the first streak of `STREAK` stuck windows begins. */
function firstStreak(stuck: boolean[]): number | null {
  let run = 0
  for (let i = 0; i < stuck.length; i += 1) {
    run = stuck[i] ? run + 1 : 0
    if (run >= STREAK) return i - STREAK + 1
  }
  return null
}

/**
 * Read a loop off the window answers, and price it against a step counter.
 *
 * An unanswered window is treated as *not* stuck: a missing judgement is not
 * evidence of a loop, and the safe default is the one that never invents a stop
 * — the same asymmetry the counter gets wrong in the other direction.
 */
export function detectLoop(
  windows: Array<{ startStep: number; answer: JevAnswer | undefined }>,
  totalSteps: number,
): LoopReport {
  const verdicts: WindowVerdict[] = windows.map(({ startStep, answer }) => {
    const probability = probabilityOf(answer)
    return {
      startStep,
      probability,
      stuck: probability !== null && probability >= STUCK_THRESHOLD,
    }
  })

  const streakAt = firstStreak(verdicts.map((w) => w.stuck))
  const looping = streakAt !== null
  const onsetStep = streakAt !== null ? verdicts[streakAt]!.startStep : null

  // A counter lets a run go until the cap, or until it ends on its own.
  const counterEnd = Math.min(MAX_ITERATIONS, totalSteps)
  const stepsSaved =
    onsetStep !== null ? Math.max(0, counterEnd - onsetStep) : 0
  const falseCut = !looping && totalSteps > MAX_ITERATIONS

  const trace: PolicyLine[] = []
  const line = (code: string, fired?: boolean, note?: string) =>
    trace.push({ code, fired, note })

  line("const STUCK = 0.6, STREAK = 3, CAP = 10")
  line("")
  line("stuck = windows.map(w => w.noul >= STUCK)")
  line("onset = firstRunOf(stuck, STREAK)", looping, onsetStep ? `step ${onsetStep}` : undefined)
  line("")
  if (looping) {
    line("// a run of stuck windows — stop at the onset", true)
    line("return { stop: onset }", true, `saves ${stepsSaved} vs the cap`)
  } else {
    line("// never a streak — let it run", true)
    line(
      "return { stop: null }",
      true,
      falseCut ? `cap would cut at ${MAX_ITERATIONS}` : "agrees: let it finish",
    )
  }

  return {
    windows: verdicts,
    looping,
    onsetStep,
    totalSteps,
    counterEnd,
    stepsSaved,
    falseCut,
    trace,
  }
}
