import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { health } from "./jev-client"

import type { HealthResponse, ServerMode } from "@shared/jev.ts"

interface SpendContextValue {
  mode: ServerMode | "unknown"
  model: string
  spend: HealthResponse["spend"]
  /** Re-read cumulative usage from the sidecar after a billed call. */
  refresh: () => Promise<void>
}

const EMPTY: HealthResponse["spend"] = {
  calls: 0,
  input_tokens: 0,
  output_tokens: 0,
  cost: 0,
}

const SpendContext = createContext<SpendContextValue | null>(null)

/**
 * Session spend, owned by the server and mirrored here.
 *
 * The sidecar is the single source of truth: it is what actually sees `usage`
 * on each response, and the batch routes bill many calls the client never
 * counts individually. The client only ever asks it for the current total.
 */
export function SpendProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ServerMode | "unknown">("unknown")
  const [model, setModel] = useState("—")
  const [spend, setSpend] = useState(EMPTY)

  const refresh = useCallback(async () => {
    try {
      const status = await health()
      setMode(status.mode)
      setModel(status.model)
      setSpend(status.spend)
    } catch {
      // The sidecar may not be up yet in dev; the shell renders regardless and
      // the next refresh will pick it up.
      setMode("unknown")
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ mode, model, spend, refresh }),
    [mode, model, spend, refresh],
  )

  return <SpendContext.Provider value={value}>{children}</SpendContext.Provider>
}

export function useSpend(): SpendContextValue {
  const context = useContext(SpendContext)
  if (!context) throw new Error("useSpend must be used inside <SpendProvider>")
  return context
}
