export interface Prompt {
  id: string
  label: string
  text: string
}

/** Prompts that land on different rungs, including one that should not be routed at all. */
export const PROMPTS: Prompt[] = [
  {
    id: "reformat",
    label: "Reformat a list",
    text: "Turn this list of names into a comma-separated string, last name first: Ada Lovelace, Grace Hopper, Katherine Johnson.",
  },
  {
    id: "summarize",
    label: "Summarise a thread",
    text: "Summarise this support thread in three bullets for a handover note. Keep the customer's actual ask in the first bullet.",
  },
  {
    id: "debug-race",
    label: "Debug a race condition",
    text: "Our worker occasionally processes the same job twice under load. We use Postgres SKIP LOCKED to claim rows and mark them done after the handler returns. Walk through where the race is and what the fix costs us in throughput.",
  },
  {
    id: "migration-plan",
    label: "Plan a migration over a large repo",
    text: "Go through our entire monorepo — about 400k lines — and produce a staged plan for moving off the deprecated auth middleware, including which packages have to move together and what can ship independently.",
  },
  {
    id: "vague",
    label: "Too vague to route",
    text: "Can you make the dashboard better?",
  },
]

export const stateFor = (prompt: Prompt) => ({ request: prompt.text })
