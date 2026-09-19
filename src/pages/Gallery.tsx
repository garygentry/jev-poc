import { Link } from "react-router-dom"
import { ArrowRight, KeyRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ShapeStrip } from "@/components/layout/DemoFrame"
import { demos } from "@/demos/registry"
import { useSpend } from "@/lib/spend-context"
import { JEV_USD_PER_INPUT_TOKEN } from "@shared/jev.ts"

export function Gallery() {
  const { mode } = useSpend()

  return (
    <div className="space-y-8">
      <section className="max-w-3xl space-y-4">
        <Badge variant="mark" className="font-mono">
          typesafe/jev-1.13
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          A model that decides instead of writing
        </h1>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Jev is a <em>System One</em> model. You send it{" "}
          <span className="font-mono text-ink">state</span> plus a map of named{" "}
          <span className="font-mono text-ink">questions</span>, and it returns
          typed answers with calibrated probabilities. There is no prose to
          parse, and no free-text-to-struct failure mode — the output is
          constrained to the options you supplied, so the interesting work moves
          out of prompt engineering and into ordinary code.
        </p>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Every question in one request is answered against the same state{" "}
          <strong className="font-medium text-ink">in parallel</strong>, so
          asking seven costs about what asking one costs. Questions over{" "}
          <em>different</em> state cannot batch at all. Those two facts are what
          the eight demos below are organised around.
        </p>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--hairline)] pt-4">
          <Fact label="Latency" value="70–500ms" />
          <Fact
            label="Input"
            value={`$${(JEV_USD_PER_INPUT_TOKEN * 1_000_000).toFixed(3)}/M`}
          />
          <Fact label="Output" value="free" />
          <Fact label="Context" value="32k" />
        </dl>
      </section>

      {mode === "fixture" ? <NoKeyNotice /> : null}

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-ink-muted">
          Eight shapes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {demos.map((demo, index) => (
            <Card key={demo.slug} className="transition-colors hover:border-[var(--mark)]/40">
              <Link to={`/demo/${demo.slug}`} className="block p-4 sm:p-5">
                <div className="flex items-baseline gap-2.5">
                  <span className="tabular font-mono text-[11px] text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{demo.title}</h3>
                  <ArrowRight className="ml-auto size-3.5 shrink-0 text-ink-muted" />
                </div>
                <p className="mt-1 pl-[26px] text-sm text-ink-secondary">
                  {demo.tagline}
                </p>
                <div className="mt-3 pl-[26px]">
                  <ShapeStrip demo={demo} />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

function NoKeyNotice() {
  return (
    <Card className="border-[var(--status-warning)]/30 bg-[var(--status-warning)]/5">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <KeyRound
          className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-ink)]"
          aria-hidden
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">
            Running without a key — nothing here is a real judgement
          </p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Every demo still works, replaying committed fixtures so the app is
            explorable offline. Those fixtures are{" "}
            <strong className="font-medium text-ink">hand-seeded</strong>, not
            recordings; wide fan-outs fall back to a deterministic stand-in that
            is shaped like a response and means nothing. Both are badged
            wherever they appear.
          </p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Paste an{" "}
            <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--mark)] underline underline-offset-2"
            >
              OpenRouter key
            </a>{" "}
            into <span className="font-mono text-ink">.env</span> and restart to
            go live, then run{" "}
            <span className="font-mono text-ink">pnpm capture</span> to replace
            the seeds with real responses.
          </p>
        </div>
      </div>
    </Card>
  )
}
