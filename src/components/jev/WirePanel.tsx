import { useState } from "react"
import { Check, ChevronRight, Copy } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { JevWire } from "@shared/jev.ts"

interface WirePanelProps {
  wire: JevWire
  className?: string
}

/**
 * The literal request and response, collapsed by default.
 *
 * Showing the real bytes rather than a prettied reconstruction is a large part
 * of the point: the protocol is small enough to read, and seeing it is what
 * makes "no parsing step" concrete rather than a claim.
 */
export function WirePanel({ wire, className }: WirePanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-raised)]"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-ink-muted transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />
        <span className="text-xs font-medium text-ink">On the wire</span>
        <span className="ml-auto font-mono text-[11px] text-ink-muted">
          POST /api/alpha/decisions
        </span>
      </button>

      {open ? (
        <Tabs defaultValue="request" className="border-t border-[var(--hairline)]">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
            <TabsList>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="request">
            <JsonBlock value={wire.request} />
          </TabsContent>
          <TabsContent value="response">
            <JsonBlock value={wire.response} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(value, null, 2)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused; the JSON is selectable either way.
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        className="absolute right-2 top-2 z-10"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre
        data-testid="wire-json"
        className="max-h-96 overflow-auto bg-[var(--plane)] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-ink-secondary"
      >
        {text}
      </pre>
    </div>
  )
}
