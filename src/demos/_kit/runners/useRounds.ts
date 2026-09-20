import { useCallback, useState } from "react"

import { decide } from "@/lib/jev-client"
import { useSpend } from "@/lib/spend-context"

import { roundKey } from "../fixtures"
import type { RoundsManifest } from "../types"
import type { RunEnvelope } from "./types"
import { useExample } from "./useExample"

import type { AnswerSource, JevUsage, JevWire } from "@shared/jev.ts"

export interface RoundsEnvelope<TInput, TCarry> extends RunEnvelope<TInput> {
  /** One snapshot per completed round, so the UI can show the descent. */
  rounds: TCarry[] | null
  /** Where the walk ended up. */
  carry: TCarry | null
  requests: number
}

/**
 * A walk is never automatic: it is several requests deep, so it waits to be
 * asked, exactly as a fan-out does.
 */
export function useRounds<TInput, TCarry, TRound>(
  manifest: RoundsManifest<TInput, TCarry, TRound>,
): RoundsEnvelope<TInput, TCarry> {
  const spec = manifest.walk
  const selection = useExample(manifest)
  const { refresh } = useSpend()

  const [run, setRun] = useState<{
    rounds: TCarry[]
    carry: TCarry
    usage: JevUsage
    requests: number
    wallClockMs: number
    source: AnswerSource
    wire: JevWire
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { input, selected } = selection
  const clear = useCallback(() => {
    setRun(null)
    setError(null)
  }, [])

  const start = useCallback(() => {
    setLoading(true)
    setError(null)
    setRun(null)

    const state = manifest.stateFor(input)
    const startedAt = performance.now()

    void (async () => {
      const rounds: TCarry[] = []
      const wires: unknown[] = []
      let carry = spec.initial
      let usage: JevUsage = { input_tokens: 0, output_tokens: 0, cost: 0 }
      let requests = 0
      let source: AnswerSource = "live"

      for (let depth = 0; depth < spec.maxDepth; depth += 1) {
        const planned = spec.plan(depth, carry)
        if (!planned) break

        const response = await decide({
          state,
          questions: planned.questions,
          fixtureKey:
            selected && manifest.recorded !== false
              ? roundKey(manifest.slug, selected, depth)
              : undefined,
        })

        requests += 1
        source = response.source
        usage = {
          input_tokens: usage.input_tokens + response.usage.input_tokens,
          output_tokens: usage.output_tokens + response.usage.output_tokens,
          cost: usage.cost + response.usage.cost,
        }
        wires.push({ round: depth, request: response.wire.request })

        carry = spec.advance(planned.round, response.answers, carry)
        rounds.push(carry)
      }

      return {
        rounds,
        carry,
        usage,
        requests,
        wallClockMs: Math.round(performance.now() - startedAt),
        source,
        wire: { request: wires, response: "one response per round" },
      }
    })()
      .then((result) => {
        setRun(result)
        void refresh()
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => setLoading(false))
  }, [manifest, input, selected, spec, refresh])

  return {
    ...selection,
    select: (id: string) => {
      selection.select(id)
      clear()
    },
    setInput: (next: TInput) => {
      selection.setInput(next)
      clear()
    },
    // Each round answers a different question set, so there is no one set of
    // answers to show. The descent itself is the result.
    answers: null,
    rounds: run?.rounds ?? null,
    carry: run?.carry ?? null,
    requests: run?.requests ?? 0,
    error,
    loading,
    latencyMs: run?.wallClockMs,
    usage: run?.usage,
    calls: run?.requests,
    source: run?.source,
    wire: run?.wire,
    run: start,
    clear,
  }
}
