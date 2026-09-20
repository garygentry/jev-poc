import { DemoScaffold, useLiveRun } from "@/demos/_kit"
import { Sparkline } from "@/components/jev/Sparkline"
import { SourceBadge } from "@/components/jev/Readouts"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { DEBOUNCE_MS, MIN_CHARS, manifest, type Draft } from "./demo"
import { Meters } from "./view"

const longEnough = (draft: Draft) => draft.text.trim().length >= MIN_CHARS

export default function TypewriterDemo() {
  const run = useLiveRun(manifest, {
    debounceMs: DEBOUNCE_MS,
    shouldAsk: longEnough,
  })

  const tooShort = !longEnough(run.input)

  return (
    <DemoScaffold
      manifest={manifest}
      run={run}
      // No run bar: nothing here is triggered by a button, and the readouts
      // would be stale between pauses anyway.
      showRunBar={false}
      before={<Chips run={run} />}
    >
      {({ answers }) => (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <div className="min-w-0 space-y-4">
            <Editor run={run} tooShort={tooShort} />

            <Card>
              <div className="p-4 sm:p-5">
                <Sparkline values={run.history} label="Round trip" />
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                  One request carries all twelve questions. Asking the twelfth
                  costs roughly what asking the first costs, which is the only
                  reason a panel like this can exist.
                </p>
              </div>
            </Card>
          </div>

          <div className="min-w-0 space-y-3">
            {tooShort || !answers ? (
              <Card>
                <p className="p-6 text-center text-sm text-ink-muted">
                  {tooShort ? "Waiting for enough text to judge." : "Asking…"}
                </p>
              </Card>
            ) : (
              <Meters answers={answers} />
            )}
          </div>
        </div>
      )}
    </DemoScaffold>
  )
}

function Chips({ run }: { run: ReturnType<typeof useLiveRun<Draft>> }) {
  return (
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
              : "border-[var(--hairline)] text-ink-secondary hover:border-[var(--mark)]/40 hover:text-ink",
          )}
        >
          {example.label}
        </button>
      ))}
    </div>
  )
}

function Editor({
  run,
  tooShort,
}: {
  run: ReturnType<typeof useLiveRun<Draft>>
  tooShort: boolean
}) {
  return (
    <Card>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="draft" className="text-xs font-medium text-ink">
            Your draft
          </label>
          <span className="flex items-center gap-2">
            {run.source ? <SourceBadge source={run.source} /> : null}
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors",
                run.loading ? "bg-[var(--mark)]" : "bg-[var(--axis)]",
              )}
              aria-label={run.loading ? "Asking" : "Idle"}
            />
          </span>
        </div>

        <Textarea
          id="draft"
          value={run.input.text}
          onChange={(event) => run.setInput({ text: event.target.value })}
          rows={9}
          placeholder="Start typing. Twelve judgements re-answer on every pause…"
          className="min-h-48 resize-y font-sans leading-relaxed"
        />

        <p className="tabular text-[11px] text-ink-muted">
          {run.input.text.trim().length} characters
          {tooShort ? ` — ${MIN_CHARS} needed before asking` : null}
        </p>
      </div>
    </Card>
  )
}
