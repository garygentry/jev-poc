import { useMemo, useState } from "react"

import { DemoFrame } from "@/components/layout/DemoFrame"
import { Card } from "@/components/ui/card"
import { demoBySlug } from "@/demos/registry"

import { GUESSED_THRESHOLD, SAMPLES } from "./data"
import { bestThreshold, evaluate, sweep } from "./policy"
import { F1Curve, FitHeadline, MetricsPanel, SampleStrip } from "./view"

export default function ThresholdFitterDemo() {
  const demo = demoBySlug("threshold-fitter")!

  const points = useMemo(() => sweep(SAMPLES), [])
  const fitted = useMemo(() => bestThreshold(SAMPLES), [])
  const guessed = useMemo(() => evaluate(SAMPLES, GUESSED_THRESHOLD), [])

  const [threshold, setThreshold] = useState(fitted.threshold)
  const metrics = useMemo(() => evaluate(SAMPLES, threshold), [threshold])

  return (
    <DemoFrame demo={demo}>
      <FitHeadline fitted={fitted} guessed={guessed} />

      <Card>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-xs font-medium text-ink">Drag the threshold</h4>
            <span className="text-[11px] text-ink-muted">
              relevant above · irrelevant below · ringed = misclassified
            </span>
          </div>
          <SampleStrip samples={SAMPLES} threshold={threshold} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="threshold"
            className="w-full accent-[var(--mark)]"
          />
        </div>
      </Card>

      <MetricsPanel metrics={metrics} fitted={fitted.threshold} guessed={GUESSED_THRESHOLD} onPick={setThreshold} />

      <F1Curve
        points={points}
        fitted={fitted.threshold}
        guessed={GUESSED_THRESHOLD}
        current={threshold}
        onPick={setThreshold}
      />
    </DemoFrame>
  )
}
