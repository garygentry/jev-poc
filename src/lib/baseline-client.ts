import {
  BASELINE_MODEL,
  parseBaseline,
  promptFor,
  schemaFor,
} from "@shared/baseline.ts"

import { JevRequestError } from "./jev-client"

import type {
  BaselineAnswer,
  ChatRequest,
  ChatResponse,
} from "@shared/baseline.ts"
import type { JevQuestionSet, JevState, JevUsage } from "@shared/jev.ts"

/** A measured baseline run: a typed answer set, and what it cost to get it. */
export interface BaselineRun {
  answers: Record<string, BaselineAnswer>
  usage: JevUsage
  latencyMs: number
  /** The model OpenRouter actually served. */
  model: string
}

/**
 * Ask a chat model for the same structured answer this question set produces.
 *
 * The schema and the prompt are both derived from the question set, so one call
 * serves every demo that opts in — the only per-demo input is its own state.
 * The result is coerced through `parseBaseline` before it is returned, so a
 * caller receives answers comparable to Jev's or an error, never a raw body.
 */
export async function runBaseline(
  questions: JevQuestionSet,
  state: JevState,
  model: string = BASELINE_MODEL,
  signal?: AbortSignal,
): Promise<BaselineRun> {
  const { system, user } = promptFor(state, questions)
  const request: ChatRequest = {
    model,
    system,
    user,
    schema: schemaFor(questions),
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    const detail = await response
      .json()
      .then((json: { error?: string }) => json.error)
      .catch(() => undefined)
    throw new JevRequestError(
      detail ?? `Baseline request failed with ${response.status}`,
      response.status,
    )
  }

  const body = (await response.json()) as ChatResponse
  return {
    answers: parseBaseline(body.content, questions),
    usage: body.usage,
    latencyMs: body.latencyMs,
    model: body.model,
  }
}
