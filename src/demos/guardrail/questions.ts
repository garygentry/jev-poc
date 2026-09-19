import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * The permission gate a coding agent needs before it runs a shell command.
 *
 * This is the use case Jev is most obviously built for: a decision that has to
 * happen on every tool call, must be fast enough not to be felt, and must
 * return something the calling code can branch on rather than prose it has to
 * interpret.
 *
 * The questions are deliberately about *properties of the command*, not about
 * whether to allow it. Allowing is a policy decision, and policy belongs in
 * code where it can be tested and audited.
 */
export const QUESTIONS: JevQuestionSet = {
  blast_radius: {
    type: "choice",
    instructions:
      "The worst outcome if this command runs and its effect was not intended.",
    criteria: {
      read_only:
        "Observes state without changing it: listing, reading, printing, querying.",
      reversible:
        "Changes state in a way an ordinary undo recovers: editing a tracked file, installing a package, creating a branch.",
      destructive:
        "Discards work or data that is not recoverable from the working tree: deleting files, force-resetting, dropping a local database.",
      catastrophic:
        "Affects shared or production systems, or exposes credentials: deleting remote data, force-pushing a shared branch, sending secrets off the machine.",
    },
  },

  reversibility: {
    type: "score",
    instructions: "How hard it would be to undo this command's effect.",
    criteria: [
      "Nothing to undo; the command changed no state.",
      "A single ordinary step undoes it, using tools already present.",
      "Recovery depends on a backup, a remote copy, or a support request.",
    ],
  },

  touches_secrets: {
    type: "noul",
    instructions:
      "The command reads, prints, or transmits credentials, tokens, keys, or environment secrets.",
  },

  network_egress: {
    type: "noul",
    instructions:
      "The command sends data to, or executes content fetched from, a remote host.",
  },

  affects_production: {
    type: "noul",
    instructions:
      "The command targets a shared, remote, or production system rather than the local working copy.",
  },

  outside_workspace: {
    type: "noul",
    instructions:
      "The command's effect reaches outside `state.cwd` — absolute paths elsewhere, the home directory, or system locations.",
  },
}
