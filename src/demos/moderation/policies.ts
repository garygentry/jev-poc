import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * What a tripped policy triggers.
 *
 * `block` is a hard stop; `review` queues the content for a human. The
 * distinction is what lets thresholds differ by consequence rather than by a
 * single global cutoff — the whole point of the demo.
 */
export type Severity = "block" | "review"

export interface Policy {
  key: string
  label: string
  /** The proposition the gate answers about the content. */
  instructions: string
  criteria: { true: string; false: string }
  /**
   * The probability at which this policy trips — set per policy, not globally.
   *
   * Severe, irreversible harms are set low: acting on a weak signal costs a
   * review, while missing one is the harm the whole system exists to prevent.
   * Soft categories are set high, because a false block on frustration or a
   * clumsy joke is its own harm and the cost of missing spam is a nuisance.
   */
  threshold: number
  severity: Severity
}

/**
 * Twelve moderation policies, judged against one piece of content in one
 * request.
 *
 * They share a state — the same message — so they batch: twelve nouls ride in a
 * single call, where a chat baseline needs twelve prompts or one long, fragile
 * one. Each carries its own threshold, so severity is expressed in the numbers,
 * not smuggled into one cutoff that treats a death threat like a spam link.
 */
export const POLICIES: Policy[] = [
  {
    key: "csae",
    label: "Child sexual content",
    instructions: "Does the content sexualise a minor in any way?",
    criteria: {
      true: "It sexualises, solicits, or depicts a minor sexually.",
      false: "It does not involve the sexualisation of a minor.",
    },
    threshold: 0.35,
    severity: "block",
  },
  {
    key: "threat",
    label: "Violent threat",
    instructions: "Does the content threaten violence against a specific person?",
    criteria: {
      true: "It threatens to harm or kill an identifiable person, or intimidates them with violence.",
      false: "It expresses no credible threat of violence against a person.",
    },
    threshold: 0.45,
    severity: "block",
  },
  {
    key: "self_harm",
    label: "Self-harm encouragement",
    instructions: "Does the content encourage or instruct self-harm or suicide?",
    criteria: {
      true: "It urges someone to hurt or kill themselves, or gives means to.",
      false: "It does not encourage or instruct self-harm.",
    },
    threshold: 0.45,
    severity: "block",
  },
  {
    key: "weapons",
    label: "Weapon instructions",
    instructions: "Does the content give instructions to build a weapon or explosive?",
    criteria: {
      true: "It provides actionable steps to make a weapon, explosive, or the like.",
      false: "It does not instruct the making of a weapon.",
    },
    threshold: 0.55,
    severity: "block",
  },
  {
    key: "illicit",
    label: "Serious-crime instructions",
    instructions:
      "Does the content give actionable instructions to commit a serious crime?",
    criteria: {
      true: "It walks through committing a serious crime — synthesising drugs, breaking into a system, laundering money.",
      false: "It does not give actionable instructions for a serious crime.",
    },
    threshold: 0.55,
    severity: "block",
  },
  {
    key: "malware",
    label: "Malware",
    instructions: "Does the content provide malicious code or steps to attack a system?",
    criteria: {
      true: "It supplies working malicious code or a concrete method to compromise a system.",
      false: "It does not provide malware or an attack method.",
    },
    threshold: 0.55,
    severity: "block",
  },
  {
    key: "hate",
    label: "Hate speech",
    instructions:
      "Does the content attack or dehumanise people for a protected characteristic?",
    criteria: {
      true: "It demeans or dehumanises a group for race, religion, gender, sexuality, or the like.",
      false: "It does not attack a protected group.",
    },
    threshold: 0.6,
    severity: "block",
  },
  {
    key: "harassment",
    label: "Harassment",
    instructions: "Does the content target an individual with insults or bullying?",
    criteria: {
      true: "It demeans, insults, or bullies a specific person.",
      false: "It criticises work or ideas without attacking the person, or is not targeted at all.",
    },
    threshold: 0.6,
    severity: "review",
  },
  {
    key: "sexual",
    label: "Adult sexual content",
    instructions: "Is the content sexually explicit (involving adults)?",
    criteria: {
      true: "It is explicit sexual content.",
      false: "It is not sexually explicit.",
    },
    threshold: 0.65,
    severity: "review",
  },
  {
    key: "pii",
    label: "Doxxing / private info",
    instructions: "Does the content expose someone's private personal information?",
    criteria: {
      true: "It reveals a private individual's home address, phone, or the like without consent.",
      false: "It does not expose private personal information.",
    },
    threshold: 0.6,
    severity: "review",
  },
  {
    key: "spam",
    label: "Spam / scam",
    instructions: "Is the content unsolicited promotion, a scam, or bulk advertising?",
    criteria: {
      true: "It pushes a scam, a get-rich scheme, or unsolicited bulk promotion.",
      false: "It is a genuine message, not promotional bulk or a scam.",
    },
    threshold: 0.8,
    severity: "review",
  },
  {
    key: "misinfo",
    label: "Harmful misinformation",
    instructions:
      "Does the content state a harmful false claim about health, safety, or civic process as fact?",
    criteria: {
      true: "It asserts a dangerous falsehood as fact — a fake cure, a safety lie, an election falsehood.",
      false: "It makes no harmful false factual claim.",
    },
    threshold: 0.8,
    severity: "review",
  },
]

/** Build the manifest's question set from the policies, so the two stay in step. */
export const buildQuestions = (): JevQuestionSet =>
  Object.fromEntries(
    POLICIES.map((p) => [
      p.key,
      { type: "noul" as const, instructions: p.instructions, criteria: p.criteria },
    ]),
  )
