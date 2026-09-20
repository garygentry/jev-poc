import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { projectJevSpend, UNDECIDED_FLOOR } from "@shared/jev.ts"

/**
 * The spine of the tour.
 *
 * The gallery shows twenty shapes; this page is the one place that explains what
 * they have in common — the three primitives and how to pick one, why a request
 * carries a single state, how a threshold turns a probability into a decision,
 * and the honesty rules the whole repo holds itself to. Everything here is
 * stated once so a demo never has to re-teach it.
 */
export function Method() {
  return (
    <div className="space-y-12">
      <section className="max-w-3xl space-y-4">
        <Badge variant="mark" className="font-mono">
          the method
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          How to read every demo
        </h1>
        <p className="text-sm leading-relaxed text-ink-secondary">
          The gallery is a set of <em>shapes</em>, not a feature list. Each one
          teaches a different way of putting the same three questions to Jev, so
          it helps to know the pieces before touring them. This page names them:
          the three primitives, why a request carries one state, how a threshold
          turns an answer into an action, and the rules this repo will not bend
          about what it shows you.
        </p>
      </section>

      <Primitives />
      <Shapes />
      <Thresholds />
      <Honesty />

      <div className="border-t border-[var(--hairline)] pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--mark)] underline underline-offset-2"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to the gallery
        </Link>
      </div>
    </div>
  )
}

/** The three question types, what each returns, and when to reach for it. */
function Primitives() {
  return (
    <Section
      eyebrow="Three primitives"
      title="Choice, Score, Noul"
      lede="Every demo is built from three question types. Jev answers all of them
        as calibrated probabilities, never as prose — the type decides the shape
        of the answer, and picking the right one is most of the design work."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <PrimitiveCard
          name="choice"
          returns="one option key + a distribution over all of them"
          summary="One of a fixed set of options. You supply the keys and a
            description of when each applies."
          pick="Reach for it when the answer is one of a known, closed set —
            a bucket, a route, a verdict."
          gotcha="Always offer a no-match option. The model cannot return a
            value you never gave it, so without one it is forced to pick among
            wrong answers."
        />
        <PrimitiveCard
          name="score"
          returns="a probability-weighted mean level, which can land between levels"
          summary="A position along a dimension you define as an ordered list of
            levels. Levels are 0-indexed."
          pick="Reach for it when the answer is a degree — severity, effort,
            confidence — and the space between two levels is meaningful."
          gotcha="Describe each level as a concrete situation, not an abstract
            degree: “a workaround exists”, not “medium”."
        />
        <PrimitiveCard
          name="noul"
          returns="a single probability, 0–1, that the proposition holds"
          summary="Whether a proposition is true, answered as a probability
            rather than a boolean. Optional true/false criteria sharpen the edge."
          pick="Reach for it for a yes/no you want to act on by degree — a gate,
            a check, an acceptance criterion."
          gotcha="0.5 is genuine uncertainty, not “half true”. The probability
            already is the answer; there is no separate confidence."
        />
      </div>
    </Section>
  )
}

function PrimitiveCard({
  name,
  returns,
  summary,
  pick,
  gotcha,
}: {
  name: string
  returns: string
  summary: string
  pick: string
  gotcha: string
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <Badge variant="mark" className="font-mono">
          {name}
        </Badge>
      </div>
      <p className="text-sm leading-relaxed text-ink-secondary">{summary}</p>
      <dl className="space-y-2 border-t border-[var(--hairline)] pt-3 text-sm">
        <Field label="Returns" value={returns} />
        <Field label="Pick it when" value={pick} />
        <Field label="Watch for" value={gotcha} />
      </dl>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 leading-relaxed text-ink-secondary">{value}</dd>
    </div>
  )
}

/** Why one request carries one state, and what that forces. */
function Shapes() {
  return (
    <Section
      eyebrow="The shapes"
      title="Why a request carries one state"
      lede="One rule organises the whole tour: questions batch into a single
        request only when they share the same state. Everything the gallery
        shows is a consequence of it."
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Send Jev one <span className="font-mono text-ink">state</span> and a
          map of named <span className="font-mono text-ink">questions</span>, and
          every question is answered against that state{" "}
          <strong className="font-medium text-ink">in parallel, in one
          request</strong>. Asking seven costs about what asking one costs.
          Questions over <em>different</em> state cannot share a request at all —
          each state is its own round trip. That single fact is why a demo that
          fans questions wide and a demo that fans requests wide are teaching two
          genuinely different things.
        </p>

        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Each demo states its shape up front as three numbers, so you can read
          its cost before running it:
        </p>

        <dl className="grid gap-3 sm:grid-cols-3">
          <ShapeCell
            term="Questions"
            def="How many questions ride in one request. Widening this is nearly
              free — they share the state."
          />
          <ShapeCell
            term="States"
            def="How many distinct states are judged. Widening this is what forces
              a fan-out, and where cost grows."
          />
          <ShapeCell
            term="Requests"
            def="How many upstream calls the two work out to. This is the number
              the spend meter moves."
          />
        </dl>

        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Fan-outs are capped server-side and never fire on render, and any demo
          whose cost grows with its input is badged for it. A single decision
          call is projected at roughly{" "}
          <span className="font-mono text-ink">
            ${projectJevSpend(1).toFixed(5)}
          </span>{" "}
          of input — output tokens are free — but the meter only ever reports the
          measured cost of work actually done.
        </p>
      </div>
    </Section>
  )
}

function ShapeCell({ term, def }: { term: string; def: string }) {
  return (
    <Card className="p-4">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {term}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">{def}</dd>
    </Card>
  )
}

/** How a probability becomes a decision. */
function Thresholds() {
  return (
    <Section
      eyebrow="Thresholds"
      title="Turning a probability into an action"
      lede="Jev returns a distribution, not a verdict. Where you set the line
        between “act on this” and “don’t” is a decision you own — and it has to
        be set against real output, not guessed."
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          A confident answer and a flat one look the same until you check the
          shape of the distribution. A near-zero confidence is Jev saying it{" "}
          <em>cannot distinguish</em> between the options — which is a different
          statement from a low-but-real answer, and acting on the top option
          anyway is a mistake. So a flat distribution is treated as its own state
          (“cannot tell”) and is never acted on, rather than being rounded to
          whichever option nudged ahead.
        </p>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-sm text-ink">UNDECIDED_FLOOR</span>
            <span className="tabular font-mono text-sm text-[var(--mark)]">
              = {UNDECIDED_FLOOR}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            The floor below which a Choice or Score answer is read as undecided.
            It started at <span className="font-mono">0.05</span>, tuned against
            hand-written fixtures — then live Jev returned{" "}
            <span className="font-mono">0.09</span> for a three-way split of{" "}
            <span className="font-mono">0.38 / 0.40 / 0.22</span>, about as
            undecided as an answer gets, and it sailed over the old floor.
            Thresholds tuned against a weaker or invented model do not transfer;
            this one is set where live answers put it.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            What the floor is <em>not</em> for: a decided answer held weakly — a
            genuine <span className="font-mono">0.51</span> against{" "}
            <span className="font-mono">0.49</span> — is a real signal, not a
            flat one. Those are what per-branch confidence gates are for, and
            conflating the two throws the signal away.
          </p>
        </Card>

        <Card className="border-dashed p-4 sm:p-5">
          <Badge variant="outline" className="font-mono">
            planned demo
          </Badge>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            A <span className="font-mono text-ink">threshold-fitter</span> demo —
            fitting a floor against a corpus of real answers rather than picking
            one by hand — is planned for a later tranche and is not built yet.
            Until it lands, the fitting story lives here and in the calibration
            note on <span className="font-mono text-ink">UNDECIDED_FLOOR</span>.
          </p>
        </Card>
      </div>
    </Section>
  )
}

/** The constraints the repo will not relax, stated so a reader can hold it to them. */
function Honesty() {
  return (
    <Section
      eyebrow="Honesty rules"
      title="What this repo will not do"
      lede="These are load-bearing. They are the difference between a demo and a
        sales page, and every card in the tour is built to keep them."
    >
      <ul className="max-w-3xl space-y-2.5">
        <Rule>
          Measured figures are <strong className="font-medium text-ink">withheld,
          not estimated</strong>, when the model did not answer — no latency,
          cost or accuracy without a live source.
        </Rule>
        <Rule>
          Replayed answers are badged; hand-seeded and synthetic fixtures are
          badged <em>differently</em>, so nothing replayed is ever presented as
          live.
        </Rule>
        <Rule>
          Ties are not rankings — bounds are reported on both sides of any
          comparison, and a flat distribution renders as “cannot tell”.
        </Rule>
        <Rule>
          Model prices are dated external data and are only ever used to{" "}
          <em>project</em>, never to report what a real run cost.
        </Rule>
        <Rule>
          Fan-outs are capped server-side and never fire on render, and the API
          key stays in the sidecar.
        </Rule>
        <Rule>
          No model is ever scored as “correct”: these fixtures have no ground
          truth, so the disagreement is shown and the reader judges. The one
          exception is the re-rank corpus, whose gold labels were fixed before
          either ranker ran.
        </Rule>
        <Rule>
          A measured baseline is not a controlled experiment — its prompts are
          not token-identical to the question set, and the card says so rather
          than implying otherwise.
        </Rule>
      </ul>
    </Section>
  )
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-ink-secondary">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--mark)]" />
      <span>{children}</span>
    </li>
  )
}

/** One titled band on the page. */
function Section({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="max-w-3xl space-y-2">
        <p className="text-xs uppercase tracking-wide text-ink-muted">{eyebrow}</p>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-secondary">{lede}</p>
      </div>
      {children}
    </section>
  )
}
