import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCcw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Props {
  /** Remounts the boundary when it changes, so navigating away clears the error. */
  resetKey: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Keeps one broken demo from taking down the app.
 *
 * Without this, a render-time throw anywhere inside a demo unmounts the whole
 * tree and leaves a blank page with the real cause only in the console. A demo
 * failing should cost you that demo, not the shell and the other seven.
 */
export class DemoBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(previous: Props): void {
    // A new demo gets a clean slate; otherwise the error would persist across
    // navigation and the app would look permanently broken.
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Demo crashed:", error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Card className="border-[var(--status-critical)]/40 bg-[var(--status-critical)]/5">
        <div className="flex items-start gap-3 p-5">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-[var(--status-critical-ink)]"
            aria-hidden
          />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-ink">This demo failed to render</p>
            <p className="text-sm leading-relaxed text-ink-secondary">
              The rest of the app is unaffected — pick another demo from the
              sidebar, or try this one again.
            </p>
            <p className="break-words font-mono text-[11px] text-ink-muted">
              {error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ error: null })}
            >
              <RotateCcw />
              Try again
            </Button>
          </div>
        </div>
      </Card>
    )
  }
}
