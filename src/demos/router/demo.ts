import type { SingleManifest } from "@/demos/_kit/types"

export interface Prompt {
  text: string
}

/**
 * Prompts that land on different rungs, including one that should not be
 * routed at all.
 *
 * These are **self-contained on purpose**, and were not at first. The earlier
 * set said things like "summarise this support thread" without the thread, and
 * live Jev correctly answered that the request needed information it had not
 * been given — `needs_tools` at 0.73 for a summarisation. The model was right
 * and the examples were wrong: a router sees the request *and* whatever came
 * with it, so anything the task depends on belongs in the state.
 *
 * `migration-plan` is the deliberate exception. It genuinely needs a codebase
 * nobody pasted, which is exactly why it should come back needing tools and
 * long context.
 *
 * Kept as a plain list and mapped below rather than written inline, because the
 * indentation inside these template literals is part of the prompt text.
 */
const PROMPTS = [
  {
    id: "reformat",
    label: "Reformat a list",
    text: "Turn this list of names into a comma-separated string, last name first: Ada Lovelace, Grace Hopper, Katherine Johnson.",
  },
  {
    id: "summarize",
    label: "Summarise a thread",
    text: `Summarise this support thread in three bullets for a handover note. Put the customer's actual ask first.

— Customer: Our nightly export has been empty three days running. Nothing changed on our side.
— Agent: Can you confirm which bucket you're writing to?
— Customer: s3://acme-analytics-nightly, same as always. The job reports success.
— Agent: I can see the job completing but with zero rows. Escalating to the data team.
— Customer: We need this for the Monday board pack, so Friday at the latest.`,
  },
  {
    id: "debug-race",
    label: "Debug a race condition",
    text: `Our worker occasionally processes the same job twice under load. Walk through where the race is and what the fix costs us in throughput.

  BEGIN;
  SELECT id FROM jobs WHERE state = 'pending'
    ORDER BY created_at LIMIT 1
    FOR UPDATE SKIP LOCKED;
  COMMIT;
  -- handler runs here, outside any transaction
  UPDATE jobs SET state = 'done' WHERE id = $1;`,
  },
  {
    id: "migration-plan",
    label: "Plan a migration over a large repo",
    text: "Go through our entire monorepo — about 400k lines across 60 packages — and produce a staged plan for moving off the deprecated auth middleware, including which packages have to move together and what can ship independently.",
  },
  {
    id: "vague",
    label: "Too vague to route",
    text: "Can you make the dashboard better?",
  },
]

/**
 * What the router needs to know about a prompt before choosing a model.
 *
 * Note what is *not* asked: "which model should handle this". Naming the models
 * in the question would move the routing policy into the model, where it could
 * not be tested, versioned or changed without re-running inference. Jev is
 * asked about properties of the request; the ladder is ordinary code.
 */
export const manifest: SingleManifest<Prompt> = {
  slug: "router",
  title: "Model router",
  tagline: "Classify the request once; route it with explicit code",
  thesis:
    "One Jev call returns six typed properties of a request. Deterministic policy code uses capability confidence, task type, tool and context needs, and ambiguity to choose a worker model or request clarification without a generative routing prompt.",
  group: "foundations",
  order: 6,
  kind: "single",
  shape: { questions: "6", states: "1", requests: "1" },
  primitives: ["choice", "noul"],

  questions: {
    required_capability: {
      type: "choice",
      instructions:
        "The least capable kind of model that could complete this request well.",
      criteria: {
        trivial:
          "Mechanical transformation with one obvious right answer: reformatting, extracting a stated field, a lookup.",
        simple:
          "A single well-defined step needing fluency but no real deliberation: summarising, drafting a short reply, straightforward classification.",
        reasoning:
          "Requires holding several constraints at once, or planning a sequence of steps whose order matters.",
        expert:
          "Requires deep domain judgement, novel synthesis, or being right about something subtle where an error would be hard to notice.",
      },
    },

    task_type: {
      type: "choice",
      instructions: "What kind of work the request is asking for.",
      criteria: {
        code: "Writing, reviewing, debugging or explaining code.",
        analysis: "Interpreting data or evidence and drawing a conclusion.",
        writing: "Producing prose for a human reader.",
        extraction: "Pulling specified fields out of supplied content.",
        conversation: "Open-ended back-and-forth with no defined deliverable.",
      },
    },

    needs_tools: {
      type: "noul",
      instructions:
        "Completing the request requires calling tools or fetching information not present in the prompt.",
    },

    needs_long_context: {
      type: "noul",
      instructions:
        "The request implies working over more material than fits in roughly 200,000 tokens.",
    },

    needs_vision: {
      type: "noul",
      instructions: "The request refers to an image, screenshot, diagram or PDF.",
    },

    is_ambiguous: {
      type: "noul",
      instructions:
        "The request does not say clearly enough what is wanted for anyone to begin.",
      /*
       * The explicit `false` case exists because the first version of this
       * question did not have one, and live Jev answered above 0.6 on four of
       * five example prompts — including a plain "summarise this thread".
       *
       * It was reading the question the broad way: almost any real request is
       * underspecified in *some* respect. The distinction that matters to a
       * router is between a request whose goal is unclear and one whose goal is
       * clear but whose inputs are elsewhere — the second is `needs_tools`, not
       * ambiguity, and routing it to a human wastes everyone's time.
       */
      criteria: {
        true: "The goal itself is unclear. Two competent people would start on materially different work, and no amount of fetching context would settle which.",
        false:
          "The goal is clear, even if the material needed to do it is large, missing, or has to be fetched first.",
      },
    },
  },

  examples: PROMPTS.map(({ id, label, text }) => ({ id, label, input: { text } })),

  stateFor: (prompt) => ({ request: prompt.text }),

  estimateCalls: () => 1,
}
