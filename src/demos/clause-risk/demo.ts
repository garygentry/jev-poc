import type { FanOutManifest } from "@/demos/_kit/types"

import { CONTRACTS, stateFor, type Contract } from "./contract"

/**
 * Four risk questions, asked of every clause — a matrix fanned out.
 *
 * Each clause is one state, so its four risk reads batch into one request; the
 * fan-out is across clauses, not questions. Together that is the N clauses × M
 * risks matrix, and because each read is a noul with a threshold, only the
 * clauses that actually carry risk surface — the rest a reviewer can skim.
 */
export const manifest: FanOutManifest<Contract> = {
  slug: "clause-risk",
  title: "Clause risk",
  tagline: "Read every clause on every risk — surface only the ones that carry it",
  thesis:
    "A lawyer reads every clause of every contract to find the few that matter. Four risk questions per clause, fanned across the contract, turn that into a matrix where only the clauses that actually carry risk surface — the boilerplate stays quiet, and the review lands where it is worth spending.",
  group: "documents",
  order: 1,
  kind: "fanout",
  shape: {
    questions: "4",
    states: "one per clause",
    requests: "fanned out, capped",
  },
  primitives: ["noul"],

  displaces: {
    baseline: "a lawyer reading every clause to the same depth",
    unit: "human-minute",
    baselineUsd: 2.5,
    source: "$150/hr contract-review rate, read 2026-09-20",
  },

  questions: {
    one_sided: {
      type: "noul",
      instructions: "Does this clause favour one party at the other's expense?",
      criteria: {
        true: "It grants a right or protection to one party while denying the counterparty the equivalent, or puts an obligation on only one side.",
        false: "It applies even-handedly, or is a neutral, mutual term.",
      },
    },
    liability: {
      type: "noul",
      instructions:
        "Does this clause create significant, uncapped, or one-way liability or indemnity exposure?",
      criteria: {
        true: "It exposes a party to uncapped, unusually large, or one-directional liability or indemnification.",
        false: "It caps liability, is mutual, or does not concern liability.",
      },
    },
    lock_in: {
      type: "noul",
      instructions: "Does this clause commit a party to a term that is hard or costly to exit?",
      criteria: {
        true: "It auto-renews, runs for a long committed term, or makes leaving costly or procedurally onerous.",
        false: "It is short, freely terminable, or does not concern the term.",
      },
    },
    ip_or_data: {
      type: "noul",
      instructions:
        "Does this clause assign intellectual property, or grant broad rights over a party's data, brand, or work product?",
      criteria: {
        true: "It assigns IP, sweeps in pre-existing IP, or grants broad rights over data, brand, or work product.",
        false: "It does not transfer IP or grant broad rights over data or brand.",
      },
    },
  },

  examples: CONTRACTS.map((contract) => ({
    id: contract.id,
    label: contract.label,
    input: contract,
  })),

  itemsFor: (contract) =>
    contract.clauses.map((clause) => ({ id: clause.id, state: stateFor(clause) })),

  estimateCalls: (contract) => contract.clauses.length,
}
