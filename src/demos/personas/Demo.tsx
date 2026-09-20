import { useMemo } from "react"

import { DemoScaffold, useFanOut } from "@/demos/_kit"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { manifest } from "./demo"
import { PERSONAS } from "./personas"
import { describeSpread, readPanel } from "./spread"
import { Caveat, Panel, SpreadCard } from "./view"

const wireNote = (items: number) =>
  `${items} requests — one per reader, because each reader is a different state.`

export default function PersonasDemo() {
  const run = useFanOut(manifest, { wireNote })
  const { results } = run

  const readings = useMemo(() => (results ? readPanel(results) : null), [results])
  const spread = useMemo(
    () => (readings ? describeSpread(readings) : null),
    [readings],
  )

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      runLabel={`Poll ${PERSONAS.length} readers`}
      // The chips and the editor sit above the run bar, because the message is
      // the input here rather than a label on one.
      showExamples={false}
      before={<Editor run={run} />}
      footer={<Caveat />}
    >
      {() =>
        readings && spread ? (
          <>
            <SpreadCard
              spread={spread}
              readings={readings}
              usage={run.usage}
              wallClockMs={run.latencyMs}
              source={run.source}
            />
            <Panel readings={readings} />
          </>
        ) : null
      }
    </DemoScaffold>
  )
}

/**
 * The message, and the three pitches that pre-fill it.
 *
 * Typing clears the selected example, which is what stops an edited message
 * replaying the fixture recorded for the pitch it started as.
 */
function Editor({
  run,
}: {
  run: ReturnType<typeof useFanOut<{ text: string }>>
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {manifest.examples.map((example) => (
          <button
            key={example.id}
            type="button"
            onClick={() => run.select(example.id)}
            aria-pressed={run.selected === example.id}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              run.selected === example.id
                ? "border-[var(--mark)] bg-[var(--mark)]/10 text-ink"
                : "border-[var(--hairline)] text-ink-secondary hover:text-ink",
            )}
          >
            {example.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="space-y-3 p-4 sm:p-5">
          <label htmlFor="message" className="block text-xs font-medium text-ink">
            The message
          </label>
          <Textarea
            id="message"
            value={run.input.text}
            onChange={(event) => run.setInput({ text: event.target.value })}
            rows={4}
            className="leading-relaxed"
          />
        </div>
      </Card>
    </>
  )
}
