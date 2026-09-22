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
          Jev demo catalog
        </h1>
        <p className="text-sm leading-relaxed text-ink-secondary sm:text-base">
          Jev evaluates named choice, score, and condition-probability questions
          against supplied state, returning typed probabilities instead of
          generated prose. This site collects practical demos of using those
          outputs in application code for routing, filtering, classification,
          safety checks, and agent control.
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

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-wide text-ink-muted">
          {demos.length} demos
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {demos.map((demo, index) => (
            <Card
              key={demo.slug}
              className="h-full transition-colors hover:border-[var(--mark)]/40"
            >
              <Link
                to={`/demo/${demo.slug}`}
                className="flex h-full flex-col p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="tabular pt-0.5 font-mono text-[11px] text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-ink">
                      {demo.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-secondary">
                      {demo.tagline}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-ink-muted" />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 pl-[31px]">
                  {demo.primitives.map((primitive) => (
                    <Badge
                      key={primitive}
                      variant="mark"
                      className="font-mono"
                    >
                      {primitive}
                    </Badge>
                  ))}
                </div>

                <p className="mt-4 flex-1 pl-[31px] text-sm leading-relaxed text-ink-secondary">
                  {demo.thesis}
                </p>

                <div className="mt-5 pl-[31px]">
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
