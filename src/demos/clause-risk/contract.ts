import type { JevState } from "@shared/jev.ts"

/** One clause of a contract. */
export interface Clause {
  id: string
  heading: string
  text: string
  /** A one-line human note on why it does or doesn't surface. Not sent to the model. */
  note: string
}

export interface Contract {
  id: string
  label: string
  clauses: Clause[]
}

/** What the gate judges per row: one clause, against every risk question. */
export const stateFor = (clause: Clause): JevState => ({
  heading: clause.heading,
  clause: clause.text,
})

/**
 * A services agreement: four ordinary clauses and four that carry risk, each on
 * a different dimension.
 *
 * The ordinary ones are the point of surfacing — a reviewer should not have to
 * read definitions and a governing-law line as closely as an uncapped
 * indemnity. The risky four each lead on one dimension (a lock-in, a liability,
 * an IP grab, a one-sided termination) so the matrix reads clearly, though real
 * clauses often trip more than one.
 */
export const CONTRACTS: Contract[] = [
  {
    id: "services-agreement",
    label: "SaaS services agreement",
    clauses: [
      {
        id: "definitions",
        heading: "1. Definitions",
        text: "\"Service\" means the hosted software provided by Provider. \"Customer\" means the entity identified in the order form. \"Order Form\" means the ordering document referencing this agreement.",
        note: "Boilerplate definitions — nothing to surface.",
      },
      {
        id: "payment",
        heading: "2. Fees and Payment",
        text: "Customer shall pay undisputed fees stated in the Order Form within thirty (30) days of the invoice date. Either party may dispute an invoice in good faith, and the parties will work together promptly to resolve any dispute.",
        note: "Mutual, standard net-30 payment terms — ordinary.",
      },
      {
        id: "auto-renewal",
        heading: "3. Term and Renewal",
        text: "This agreement renews automatically for successive twelve (12) month terms unless either party gives written notice of non-renewal at least ninety (90) days before the end of the then-current term. Fees may increase by up to 10% on each renewal.",
        note: "Evergreen auto-renewal with a long notice window — a lock-in.",
      },
      {
        id: "indemnification",
        heading: "4. Indemnification",
        text: "Customer shall defend, indemnify, and hold harmless Provider from any and all claims, damages, and expenses of any kind arising from Customer's use of the Service, without limitation and regardless of the theory of liability.",
        note: "Uncapped, one-way indemnity — a liability risk.",
      },
      {
        id: "ip-assignment",
        heading: "5. Intellectual Property",
        text: "Customer hereby assigns to Provider all right, title, and interest in any feedback, configurations, and derivative materials, including any pre-existing Customer intellectual property incorporated therein.",
        note: "Sweeps in the customer's pre-existing IP — an IP grab.",
      },
      {
        id: "confidentiality",
        heading: "6. Confidentiality",
        text: "Each party shall protect the other's Confidential Information with the same degree of care it uses for its own, and shall not disclose it except to employees and contractors with a need to know who are bound by comparable obligations.",
        note: "Mutual, standard confidentiality — ordinary.",
      },
      {
        id: "termination",
        heading: "7. Termination",
        text: "Provider may terminate this agreement at any time, for any reason or no reason, upon written notice. Customer may terminate only in the event of Provider's uncured material breach after a sixty (60) day cure period.",
        note: "Termination rights only one party has — one-sided.",
      },
      {
        id: "governing-law",
        heading: "8. Governing Law",
        text: "This agreement is governed by the laws of the State of Delaware, without regard to its conflict-of-laws principles. The parties consent to the exclusive jurisdiction of the state and federal courts located therein.",
        note: "Ordinary governing-law clause — nothing to surface.",
      },
    ],
  },
]
