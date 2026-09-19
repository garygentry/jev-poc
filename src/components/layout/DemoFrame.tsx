import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Demo } from "@/demos/registry"

/**
 * The standard wrapper every demo renders inside.
 *
 * The shape strip is the through-line of the whole tour: questions · states ·
 * requests is what actually distinguishes one demo from the next, so it is
 * stated up front rather than left to be inferred from the code.
 */
export function DemoFrame({
  demo,
  children,
  aside,
}: {
  demo: Demo
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {demo.primitives.map((primitive) => (
            <Badge key={primitive} variant="mark" className="font-mono">
              {primitive}
            </Badge>
          ))}
          {demo.fansOut ? (
            <Badge variant="outline">fans out — costs scale with input</Badge>
          ) : null}
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {demo.title}
          </h1>
          <p className="mt-0.5 text-sm text-ink-secondary">{demo.tagline}</p>
        </div>

        <ShapeStrip demo={demo} />

        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          {demo.thesis}
        </p>

        {aside}
      </header>

      {children}
    </div>
  )
}

export function ShapeStrip({ demo, className }: { demo: Demo; className?: string }) {
  const cells = [
    { label: "Questions", value: demo.shape.questions },
    { label: "States", value: demo.shape.states },
    { label: "Requests", value: demo.shape.requests },
  ]

  return (
    <dl
      className={cn(
        "inline-flex flex-wrap items-stretch divide-x divide-[var(--hairline)] overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface)]",
        className,
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="px-3.5 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
            {cell.label}
          </dt>
          <dd className="tabular mt-0.5 font-mono text-xs text-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}
