/**
 * Twelve synthetic readers.
 *
 * Each persona is a *different state*, which is what makes this demo fan out:
 * the same question asked of twelve different readers cannot batch into one
 * request, because a request carries exactly one state.
 *
 * They are invented, and they are not a market. A panel of twelve made-up
 * readers tells you where a message *splits* an audience along the dimensions
 * you wrote into it — not what real people would do.
 */
export interface Persona {
  id: string
  name: string
  role: string
  seniority: string
  industry: string
  /** What they are trying to achieve at work. */
  priorities: string[]
  /** How much convincing they need, in their own terms. */
  disposition: string
}

export const PERSONAS: Persona[] = [
  {
    id: "cto-fintech",
    name: "Platform CTO",
    role: "CTO",
    seniority: "executive",
    industry: "fintech",
    priorities: ["regulatory exposure", "vendor concentration", "audit trails"],
    disposition:
      "Assumes every vendor claim is marketing until a reference customer says otherwise.",
  },
  {
    id: "staff-eng",
    name: "Staff engineer",
    role: "Staff software engineer",
    seniority: "senior individual contributor",
    industry: "B2B SaaS",
    priorities: ["on-call load", "not rewriting things twice", "real docs"],
    disposition:
      "Reads the API reference before the landing page. Allergic to adjectives.",
  },
  {
    id: "junior-dev",
    name: "Junior developer",
    role: "Software engineer",
    seniority: "early career",
    industry: "B2B SaaS",
    priorities: ["shipping their first feature", "not looking lost", "examples"],
    disposition: "Persuaded by a quickstart that works on the first try.",
  },
  {
    id: "eng-manager",
    name: "Engineering manager",
    role: "Engineering manager",
    seniority: "management",
    industry: "marketplace",
    priorities: ["team throughput", "hiring less", "predictable delivery"],
    disposition:
      "Wants to know what it replaces, not what it adds. Sceptical of new surface area.",
  },
  {
    id: "data-scientist",
    name: "Data scientist",
    role: "Data scientist",
    seniority: "mid",
    industry: "retail analytics",
    priorities: ["reproducibility", "calibration", "being able to check the numbers"],
    disposition: "Trusts a published methodology over a benchmark chart.",
  },
  {
    id: "sre",
    name: "Site reliability engineer",
    role: "SRE",
    seniority: "senior",
    industry: "infrastructure",
    priorities: ["blast radius", "latency tails", "graceful degradation"],
    disposition: "Asks what happens when it fails before asking what it does.",
  },
  {
    id: "product-manager",
    name: "Product manager",
    role: "Product manager",
    seniority: "mid",
    industry: "consumer",
    priorities: ["time to first value", "what users will feel", "roadmap risk"],
    disposition: "Responds to a concrete before-and-after, not to capability lists.",
  },
  {
    id: "procurement",
    name: "Procurement lead",
    role: "Procurement",
    seniority: "management",
    industry: "enterprise",
    priorities: ["total cost", "contract terms", "exit options"],
    disposition:
      "Reads for what is not said. Pricing that is hard to find reads as expensive.",
  },
  {
    id: "security",
    name: "Security engineer",
    role: "Application security engineer",
    seniority: "senior",
    industry: "healthcare",
    priorities: ["data residency", "least privilege", "supply chain"],
    disposition: "Treats a new dependency as a new attack surface by default.",
  },
  {
    id: "founder",
    name: "Seed-stage founder",
    role: "Founder",
    seniority: "executive",
    industry: "early-stage startup",
    priorities: ["speed", "runway", "doing more with three engineers"],
    disposition: "Buys on momentum. Will try anything that installs in a minute.",
  },
  {
    id: "academic",
    name: "Research scientist",
    role: "Research scientist",
    seniority: "senior",
    industry: "academia",
    priorities: ["novelty", "evidence", "whether the claim is falsifiable"],
    disposition: "Discounts anything without a method section.",
  },
  {
    id: "support-lead",
    name: "Support lead",
    role: "Customer support lead",
    seniority: "management",
    industry: "B2B SaaS",
    priorities: ["ticket volume", "first-response time", "agent burnout"],
    disposition: "Cares only about what changes a queue she can see today.",
  },
]

/** The persona *is* the state, with the message attached. */
export const stateFor = (persona: Persona, message: string) => ({
  reader: {
    role: persona.role,
    seniority: persona.seniority,
    industry: persona.industry,
    priorities: persona.priorities,
    disposition: persona.disposition,
  },
  message,
})
