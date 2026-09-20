import type { SingleManifest } from "@/demos/_kit/types"

/** The draft under judgement. Editable, so often not one of the examples. */
export interface Draft {
  text: string
}

/** Below this there is not enough text for any judgement to mean anything. */
export const MIN_CHARS = 40

/**
 * How long a pause counts as "stopped typing".
 *
 * Long enough that a request is not fired per keystroke, short enough that the
 * panel feels attached to the text.
 */
export const DEBOUNCE_MS = 260

/**
 * Twelve judgements about a draft, re-answered on every pause in typing.
 *
 * Twelve questions cost roughly what one costs in wall-clock time, because they
 * share a state and are answered in parallel. That is what makes this shape
 * viable at all: a panel that re-reads your draft as you write it is only
 * possible when adding the twelfth question is close to free.
 *
 * None of these ask the model to rewrite anything, because it cannot. It can
 * only tell you what is true of what you wrote.
 */
export const manifest: SingleManifest<Draft> = {
  slug: "typewriter",
  title: "Live typewriter",
  tagline: "Twelve judgements, repainting as you type",
  thesis:
    "What ~100ms buys you. Twelve questions re-answer on every pause in typing, which is a thing you simply cannot build against a model that streams prose.",
  group: "foundations",
  order: 4,
  kind: "single",
  shape: { questions: "12", states: "1", requests: "1 per pause" },
  primitives: ["choice", "score", "noul"],

  questions:  {
    tone: {
      type: "choice",
      instructions: "How this message will read to its recipient.",
      criteria: {
        warm: "Friendly and personable; acknowledges the reader.",
        neutral: "Plain and businesslike; neither warm nor cold.",
        curt: "Clipped and impatient; correct but unfriendly.",
        hostile: "Accusatory or aggressive toward the reader.",
      },
    },

    audience_fit: {
      type: "choice",
      instructions: "Who this message is pitched at, judging by how it is written.",
      criteria: {
        executive: "Assumes little context; leads with the decision or outcome.",
        peer: "Assumes shared context and vocabulary.",
        customer: "Explains internal matters in outside terms.",
        public: "Written for readers with no relationship to the sender.",
      },
    },

    clarity: {
      type: "score",
      instructions: "How easily a reader will understand what this message means.",
      criteria: [
        "The reader would have to ask what is meant.",
        "Understandable, but the reader must work for it.",
        "Plain on one reading.",
        "Plain on one reading, and the structure makes the key point unmissable.",
      ],
    },

    urgency: {
      type: "score",
      instructions: "How urgent this message presents itself as being.",
      criteria: [
        "No time pressure is implied.",
        "A timeframe is mentioned but nothing turns on it.",
        "The message asserts that something is needed immediately.",
      ],
    },

    hedging: {
      type: "score",
      instructions: "How much the message qualifies and softens its own claims.",
      criteria: [
        "States things directly.",
        "Occasional softeners that do not obscure the point.",
        "So qualified that the actual position is hard to locate.",
      ],
    },

    has_clear_ask: {
      type: "noul",
      instructions:
        "A reader would know what they are being asked to do after reading this once.",
    },

    has_deadline: {
      type: "noul",
      instructions: "The message states when a response or action is needed by.",
    },

    contains_pii: {
      type: "noul",
      instructions:
        "The message contains personal data: names with contact details, addresses, account or card numbers.",
    },

    contains_secret: {
      type: "noul",
      instructions:
        "The message contains a credential: an API key, token, password, or connection string.",
    },

    passive_aggressive: {
      type: "noul",
      instructions:
        "The message expresses irritation indirectly, through implication rather than statement.",
    },

    reads_as_complaint: {
      type: "noul",
      instructions:
        "A reader would take this primarily as a complaint rather than as a request or a report.",
    },

    ready_to_send: {
      type: "noul",
      instructions:
        "The message is finished: it makes its point, asks for what it needs, and contains no placeholders or unfinished sentences.",
    },
  },

  /** Drafts that pull the twelve meters in visibly different directions. */
  examples: [
    {
      id: "passive-aggressive",
      label: "Passive-aggressive nudge",
      input: { text: "Just circling back on this since I haven't heard anything. I know everyone's busy, but this was supposed to be done last week and I've now asked twice. Let me know if this isn't a priority any more so I can plan around it." },
    },
    {
      id: "clear-ask",
      label: "Clear, direct ask",
      input: { text: "The staging deploy is failing on the migration step. I've attached the log. Can you take a look before Thursday's release cut? If it needs a schema change I'd rather know today than Wednesday night." },
    },
    {
      id: "hedged",
      label: "Hedged into meaninglessness",
      input: { text: "I think there might possibly be some kind of issue with the way we're maybe handling retries, although I could be wrong and it may just be something on my end. It might be worth someone taking a look at some point if anyone has time, but it's probably not urgent." },
    },
    {
      id: "leaky",
      label: "Leaks a credential",
      input: { text: "Here's the staging config so you can reproduce it: DATABASE_URL=postgres://svc_app:hunter2@db-staging.internal:5432/app and the API key is sk-live-4f8a2c91bd7e. Ping me if it still fails." },
    },
    {
      id: "unfinished",
      label: "Unfinished draft",
      input: { text: "Hi team — quick update on the migration. We've finished the first two phases and TODO: numbers here. The remaining work is" },
    },
  ],

  stateFor: (draft) => ({ draft: draft.text }),

  estimateCalls: () => 1,
}
