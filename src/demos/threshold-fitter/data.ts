/**
 * A labelled set of answers something already recorded.
 *
 * Each row is a relevance judgement Jev returned for a retrieved chunk (the
 * `noul`), paired with a human label of whether the chunk was actually relevant
 * (`truth`). Nothing here is fetched at run time — this is the whole point of
 * the offline shape: the answers exist, and the demo only has to read them.
 *
 * The distribution is built to have a real overlap in the middle — a genuinely
 * ambiguous positive that scored low, and several distractors that scored
 * high because they mention the right service or share a name. That overlap is
 * what makes the threshold a choice rather than an obvious cut, and it is where
 * every other demo's hard-coded number is really a guess.
 */
export interface Sample {
  id: string
  /** A short description of the chunk. */
  label: string
  /** The relevance probability Jev recorded for it. */
  noul: number
  /** Whether the chunk was actually relevant. The label the fit is against. */
  truth: boolean
}

/** The number a demo reaches for when it has to pick one without data. */
export const GUESSED_THRESHOLD = 0.5

export const SAMPLES: Sample[] = [
  { id: "p1", label: "the exact error log for the failing request", noul: 0.99, truth: true },
  { id: "p2", label: "the config value that sets the timeout", noul: 0.97, truth: true },
  { id: "p3", label: "the function that makes the slow call", noul: 0.94, truth: true },
  { id: "p4", label: "the migration that changed the column", noul: 0.9, truth: true },
  { id: "p5", label: "the test that reproduces the bug", noul: 0.86, truth: true },
  { id: "p6", label: "the dependency version with the regression", noul: 0.81, truth: true },
  { id: "p7", label: "the feature flag gating the code path", noul: 0.76, truth: true },
  { id: "p8", label: "the retry policy wrapping the call", noul: 0.71, truth: true },
  { id: "p9", label: "a comment explaining the workaround", noul: 0.66, truth: true },
  { id: "p10", label: "a stack-trace fragment, only partly on point", noul: 0.52, truth: true },

  { id: "n1", label: "the company holiday schedule", noul: 0.03, truth: false },
  { id: "n2", label: "an unrelated marketing email", noul: 0.07, truth: false },
  { id: "n3", label: "the CSS for the login page", noul: 0.12, truth: false },
  { id: "n4", label: "a changelog from three years ago", noul: 0.2, truth: false },
  { id: "n5", label: "a README for a different service", noul: 0.31, truth: false },
  { id: "n6", label: "docs for a similar-sounding but unrelated API", noul: 0.44, truth: false },
  { id: "n7", label: "a log line for the same service, different incident", noul: 0.51, truth: false },
  { id: "n8", label: "a config file for a neighbouring module", noul: 0.57, truth: false },
  { id: "n9", label: "an old ticket about a superficially similar bug", noul: 0.62, truth: false },
  { id: "n10", label: "a function with the same name in another package", noul: 0.68, truth: false },
]
