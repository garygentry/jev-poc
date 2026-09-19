export interface Draft {
  id: string
  label: string
  text: string
}

/** Drafts that pull the twelve meters in visibly different directions. */
export const DRAFTS: Draft[] = [
  {
    id: "passive-aggressive",
    label: "Passive-aggressive nudge",
    text: "Just circling back on this since I haven't heard anything. I know everyone's busy, but this was supposed to be done last week and I've now asked twice. Let me know if this isn't a priority any more so I can plan around it.",
  },
  {
    id: "clear-ask",
    label: "Clear, direct ask",
    text: "The staging deploy is failing on the migration step. I've attached the log. Can you take a look before Thursday's release cut? If it needs a schema change I'd rather know today than Wednesday night.",
  },
  {
    id: "hedged",
    label: "Hedged into meaninglessness",
    text: "I think there might possibly be some kind of issue with the way we're maybe handling retries, although I could be wrong and it may just be something on my end. It might be worth someone taking a look at some point if anyone has time, but it's probably not urgent.",
  },
  {
    id: "leaky",
    label: "Leaks a credential",
    text: "Here's the staging config so you can reproduce it: DATABASE_URL=postgres://svc_app:hunter2@db-staging.internal:5432/app and the API key is sk-live-4f8a2c91bd7e. Ping me if it still fails.",
  },
  {
    id: "unfinished",
    label: "Unfinished draft",
    text: "Hi team — quick update on the migration. We've finished the first two phases and TODO: numbers here. The remaining work is",
  },
]

export const EMPTY_DRAFT = ""
