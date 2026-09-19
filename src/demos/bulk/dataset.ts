/**
 * A synthetic feedback corpus, generated deterministically from phrase parts.
 *
 * Written by combination rather than by hand so there is enough of it to make
 * the economics visible. It is *not* a labelled dataset and there is no ground
 * truth here — the demo measures cost and throughput, and the distribution of
 * what came back, never accuracy.
 */

const SUBJECTS = [
  "the export flow",
  "the new dashboard",
  "webhook delivery",
  "the mobile app",
  "your API docs",
  "the billing page",
  "alert configuration",
  "the onboarding wizard",
  "SSO login",
  "the query builder",
]

// Phrases are deliberately subject-agnostic: any one has to read sensibly
// after any subject, since they are combined by index rather than by topic.
const COMPLAINTS = [
  "has been timing out every afternoon since the update",
  "fails silently and never tells us why",
  "is unusable on anything narrower than a laptop",
  "loses my work every single time I navigate away",
  "throws a 500 with no message about what went wrong",
]

const REQUESTS = [
  "really needs a way to schedule this rather than clicking it by hand",
  "would be so much better with a bulk edit",
  "should let us template these instead of copying them",
  "needs an audit trail — we have no idea who changed what",
  "is missing a dark mode, which sounds trivial but we stare at it all day",
]

const PRAISE = [
  "is genuinely the best I've used, thank you",
  "saved us about a day a week, which I did not expect",
  "is fast in a way that makes the old tool feel broken",
  "finally made this legible to people outside the team",
  "works exactly the way I hoped it would",
]

const NEUTRAL = [
  "changed at some point recently — was that intentional?",
  "behaves differently on staging than on production, is that expected",
  "has a setting I can't find in the docs anywhere",
  "seems to disagree with what the CSV export says",
  "asks for confirmation twice, which I assume is a bug",
]

const OPENERS = ["", "Honestly, ", "Quick note — ", "FYI: ", "Not urgent, but "]

export interface Row {
  id: string
  text: string
}

/**
 * Build `count` rows, deterministically.
 *
 * The mix is deliberately uneven so the resulting histogram has a shape, and
 * the same index always produces the same row so a re-run is comparable.
 */
export function buildDataset(count: number): Row[] {
  const pools = [COMPLAINTS, REQUESTS, PRAISE, NEUTRAL]
  const rows: Row[] = []

  for (let index = 0; index < count; index += 1) {
    // Weighted towards complaints and requests, which is what a real feedback
    // inbox looks like.
    const poolIndex = [0, 0, 0, 1, 1, 1, 2, 3][index % 8] as number
    const pool = pools[poolIndex] as string[]
    const subject = SUBJECTS[(index * 7) % SUBJECTS.length] as string
    const phrase = pool[(index * 3) % pool.length] as string
    const opener = OPENERS[(index * 5) % OPENERS.length] as string

    rows.push({
      id: `r${String(index + 1).padStart(3, "0")}`,
      text: `${opener}${subject} ${phrase}.`,
    })
  }

  return rows
}

/** Server-enforced too, but repeated here so the UI cannot offer more. */
export const MAX_ROWS = 200
export const DEFAULT_ROWS = 60
