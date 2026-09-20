import type { JevState } from "@shared/jev.ts"

/** One piece of user content to moderate. */
export interface Content {
  id: string
  label: string
  text: string
  /** A one-line human note on the expected outcome. Not sent to the model. */
  note: string
}

/** What the gate judges: the content, checked against every policy at once. */
export const stateFor = (content: Content): JevState => ({ content: content.text })

/**
 * Six messages spanning the actions: two that pass, and four that trip a
 * different policy each — a threat, targeted harassment, doxxing, and a scam.
 *
 * The two that pass are the point of the per-policy thresholds: blunt frustration
 * and sharp criticism read as harsh but are not harassment, and a global cutoff
 * that flagged them would drown the queue in false positives. The four that trip
 * hit policies of different severities, so `block` and `review` both appear.
 */
export const CONTENTS: Content[] = [
  {
    id: "clean",
    label: "A normal message",
    text: "Thanks for the help earlier — the deploy went smoothly and the whole team is relieved. Coffee's on me next week.",
    note: "Benign — nothing should trip.",
  },
  {
    id: "criticism",
    label: "Harsh but fair criticism",
    text: "This PR is honestly a mess — the tests are flaky, the naming is inconsistent, and we shipped it anyway. We have to hold a higher bar than this.",
    note: "Frustrated and blunt, but about the work, not the person — should pass.",
  },
  {
    id: "harassment",
    label: "Targeted harassment",
    text: "You're a pathetic, brainless waste of space and everyone here is sick of pretending you belong. Just quit already.",
    note: "A personal attack — trips harassment (review).",
  },
  {
    id: "threat",
    label: "A violent threat",
    text: "I know exactly where you live and if you push this change again I will make you regret it. Watch your back.",
    note: "A credible threat — trips the threat policy (block).",
  },
  {
    id: "doxx",
    label: "Doxxing",
    text: "For anyone who wants to reach the account owner directly, her home address is 42 Elm Street, Springfield, and her personal cell is 555-0142.",
    note: "Exposes private info with no threat — trips doxxing (review).",
  },
  {
    id: "scam",
    label: "A crypto scam",
    text: "🚀 Turn $100 into $10,000 in 24 hours! I found a guaranteed crypto method the banks don't want you to know. DM me now — only 5 spots left!!!",
    note: "Unsolicited get-rich scam — trips spam (review).",
  },
]
