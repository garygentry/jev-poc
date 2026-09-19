import type { JevQuestionSet } from "@shared/jev.ts"

/**
 * What the router needs to know about a prompt before choosing a model.
 *
 * Note what is *not* asked: "which model should handle this". Naming the models
 * in the question would move the routing policy into the model, where it could
 * not be tested, versioned or changed without re-running inference. Jev is
 * asked about properties of the request; the ladder is ordinary code.
 */
export const QUESTIONS: JevQuestionSet = {
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
}
