import {
  API_KEY,
  BACKOFF_MS,
  DECISIONS_URL,
  MAX_ATTEMPTS,
  MODEL,
  REQUEST_TIMEOUT_MS,
  RETRY_STATUSES,
} from "./config.ts"

import type {
  JevQuestionSet,
  JevState,
  SystemOneResponse,
} from "@shared/jev.ts"

/** A provider failure, as distinct from a bug in the caller's question set. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

export interface JevCallResult {
  response: SystemOneResponse
  latencyMs: number
  request: unknown
  raw: unknown
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ask Jev every question against one state, in a single request.
 *
 * Questions batch into one call only when they share state — that is what makes
 * decomposition cheap, since seven questions cost roughly one question's
 * wall-clock. Different states must fan out instead; see `mapWithConcurrency`.
 *
 * @param state The content to judge.
 * @param questions Named questions, each carrying its `type` discriminator.
 * @param signal Optional abort signal, used by the debounced live demo to drop
 *   a request that a newer keystroke has already superseded.
 * @returns The parsed response alongside the measured round trip and the
 *   literal request body, so the UI can show what actually went over the wire.
 * @throws ProviderError When the endpoint is unreachable, answers non-2xx, or
 *   returns a body that is not a System One response.
 */
export async function askJev(
  state: JevState,
  questions: JevQuestionSet,
  signal?: AbortSignal,
): Promise<JevCallResult> {
  const body = { model: MODEL, state, questions }
  const startedAt = performance.now()

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // One timeout per attempt, linked to the caller's signal so an abort from
    // upstream cancels the in-flight fetch rather than just being ignored.
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const composite = signal
      ? AbortSignal.any([signal, timeout])
      : timeout

    let response: Response
    try {
      response = await fetch(DECISIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/local/jev-poc",
          "X-Title": "jev-poc",
        },
        body: JSON.stringify(body),
        signal: composite,
      })
    } catch (error) {
      // A caller-initiated abort is not a failure worth retrying — it means the
      // answer is no longer wanted.
      if (signal?.aborted) throw error
      if (attempt === MAX_ATTEMPTS) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new ProviderError(`Could not reach OpenRouter: ${reason}`)
      }
      await sleep(BACKOFF_MS * 2 ** (attempt - 1))
      continue
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      if (!RETRY_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new ProviderError(
          `OpenRouter returned ${response.status}: ${detail}`,
          response.status,
        )
      }
      await sleep(BACKOFF_MS * 2 ** (attempt - 1))
      continue
    }

    const raw: unknown = await response.json()
    const parsed = parseSystemOne(raw)
    return {
      response: parsed,
      latencyMs: Math.round(performance.now() - startedAt),
      request: body,
      raw,
    }
  }

  throw new ProviderError("OpenRouter could not be reached")
}

/**
 * Validate the response shape before anything downstream trusts it.
 *
 * A 2xx carrying an unexpected body is still a provider failure rather than a
 * caller bug, so it surfaces as `ProviderError` like every other transport
 * problem. Surfacing the surprise beats silently dropping answer types we do
 * not recognise.
 */
function parseSystemOne(raw: unknown): SystemOneResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new ProviderError("OpenRouter returned a non-object body")
  }

  const candidate = raw as Partial<SystemOneResponse>
  if (typeof candidate.answers !== "object" || candidate.answers === null) {
    const preview = JSON.stringify(raw).slice(0, 300)
    throw new ProviderError(
      `OpenRouter returned a body with no answers: ${preview}`,
    )
  }

  for (const [name, answer] of Object.entries(candidate.answers)) {
    const type = (answer as { type?: unknown })?.type
    if (type !== "choice" && type !== "score" && type !== "noul") {
      throw new ProviderError(
        `Answer "${name}" has unrecognised type ${JSON.stringify(type)}`,
      )
    }
  }

  return {
    model: candidate.model ?? MODEL,
    answers: candidate.answers,
    usage: candidate.usage ?? {
      input_tokens: 0,
      output_tokens: 0,
      cost: 0,
    },
    provider: candidate.provider,
  }
}
