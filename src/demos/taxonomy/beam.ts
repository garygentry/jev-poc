import type { ChoiceAnswer, JevQuestion } from "@shared/jev.ts"

import { childrenAt } from "./taxonomy"

/** How many branches stay alive between rounds. */
export const BEAM_WIDTH = 3

/** A branch whose cumulative path probability falls below this is dropped. */
export const PRUNE_BELOW = 0.04

/**
 * Descend past a node only while its distribution is concentrated.
 *
 * This is the part that makes the demo about *calibration* rather than about
 * tree walking. A confident answer earns another level; a flat one means Jev
 * cannot separate the children, and the honest thing is to stop and commit to
 * the parent rather than guess a leaf.
 */
export const DESCEND_CONFIDENCE = 0.45

export interface Branch {
  /** Keys from the root down to this node. */
  path: string[]
  /** Product of the conditional probabilities along the path. */
  probability: number
  /** Confidence of the Choice that selected this node's level. */
  confidence: number
  /** Set when this branch stopped descending and why. */
  stoppedBecause?: "flat" | "leaf" | "pruned" | "beam"
}

export interface Round {
  depth: number
  /** One question per branch still alive, all sharing the ticket as state. */
  questions: Record<string, JevQuestion>
  /** Which branch each question name belongs to. */
  owners: Record<string, Branch>
}

/** The question asked at one node: choose among that node's children. */
export function questionFor(branch: Branch): JevQuestion {
  const children = childrenAt(branch.path)
  const criteria: Record<string, string> = {}
  for (const child of children) criteria[child.key] = child.description

  return {
    type: "choice",
    instructions:
      branch.path.length === 0
        ? "Which area of the product this ticket is about."
        : `Within ${branch.path.join(" › ")}, which of these the ticket is about.`,
    criteria,
  }
}

/**
 * Build the next round's questions from the branches still alive.
 *
 * Every question in a round shares the same state — the ticket — so the whole
 * round is **one request**, however many branches are being expanded. That is
 * why beam search costs barely more than greedy descent here: widening the beam
 * adds questions, not round trips.
 */
export function planRound(depth: number, branches: Branch[]): Round | null {
  const expandable = branches.filter(
    (branch) => !branch.stoppedBecause && childrenAt(branch.path).length > 0,
  )
  if (expandable.length === 0) return null

  const questions: Record<string, JevQuestion> = {}
  const owners: Record<string, Branch> = {}

  for (const branch of expandable) {
    const name = branch.path.length === 0 ? "root" : branch.path.join("__")
    questions[name] = questionFor(branch)
    owners[name] = branch
  }

  return { depth, questions, owners }
}

/**
 * Expand each branch by its answer, then keep the best `BEAM_WIDTH`.
 *
 * Children are carried forward by **cumulative path probability**, not by their
 * conditional probability alone: a 0.9 child of a 0.1 parent is a worse bet
 * than a 0.5 child of a 0.8 parent, and only the product says so. Comparing
 * those numbers across different branches is only meaningful because the model
 * is calibrated — with an uncalibrated classifier the products would not be on
 * a common scale and the beam would be sorting noise.
 */
export function expand(
  round: Round,
  answers: Record<string, ChoiceAnswer>,
): Branch[] {
  const next: Branch[] = []

  for (const [name, branch] of Object.entries(round.owners)) {
    const answer = answers[name]
    if (!answer) continue

    // A flat distribution means the children are not separable. Commit here.
    if (answer.confidence < DESCEND_CONFIDENCE) {
      next.push({ ...branch, stoppedBecause: "flat", confidence: answer.confidence })
      continue
    }

    for (const [key, conditional] of Object.entries(answer.probabilities)) {
      const probability = branch.probability * conditional
      if (probability < PRUNE_BELOW) continue

      const path = [...branch.path, key]
      next.push({
        path,
        probability,
        confidence: answer.confidence,
        stoppedBecause: childrenAt(path).length === 0 ? "leaf" : undefined,
      })
    }
  }

  const ranked = [...next].sort((a, b) => b.probability - a.probability)
  const kept = ranked.slice(0, BEAM_WIDTH)
  const dropped = ranked.slice(BEAM_WIDTH).map(
    (branch): Branch => ({ ...branch, stoppedBecause: "beam" }),
  )

  return [...kept, ...dropped]
}

/** Branches still eligible to be expanded next round. */
export const alive = (branches: Branch[]): Branch[] =>
  branches.filter((branch) => !branch.stoppedBecause)

/**
 * The branch to commit to: the highest cumulative probability, whether or not
 * it reached a leaf.
 *
 * Committing to an interior node is a real answer, not a failure. "This is
 * definitely a billing/invoices ticket, and I cannot tell which kind" routes
 * correctly; a guessed leaf routes correctly only by luck.
 */
export function best(branches: Branch[]): Branch | null {
  if (branches.length === 0) return null
  return branches.reduce((winner, branch) =>
    branch.probability > winner.probability ? branch : winner,
  )
}

/**
 * Whether the winner departs from the greedy path — the argmax at every level.
 *
 * This is the only honest argument for beam search over greedy descent. When it
 * is false the beam bought nothing on this input and the extra questions were
 * waste, and the UI says so rather than implying the beam did work it did not.
 */
export function beatGreedy(rounds: Branch[][], winner: Branch): boolean {
  for (const round of rounds) {
    const top = best(round)
    if (!top || top.path.length === 0) continue
    const depth = top.path.length
    if (winner.path.length < depth) continue
    if (winner.path.slice(0, depth).join("/") !== top.path.join("/")) return true
  }
  return false
}
