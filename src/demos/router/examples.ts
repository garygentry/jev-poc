export interface Prompt {
  id: string
  label: string
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
 */
export const PROMPTS: Prompt[] = [
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

export const stateFor = (prompt: Prompt) => ({ request: prompt.text })
