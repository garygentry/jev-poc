import {
  API_KEY,
  BACKOFF_MS,
  CHAT_URL,
  DECISIONS_URL,
  MAX_ATTEMPTS,
  MAX_CHAT_TOKENS,
  MODEL,
  REQUEST_TIMEOUT_MS,
  RETRY_STATUSES,
} from "./config.ts"

import type { StructuredSchema } from "@shared/baseline.ts"
import type {
  JevQuestionSet,
  JevState,
  JevUsage,
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
  const { raw, latencyMs } = await postJson(DECISIONS_URL, body, signal)
  return { response: parseSystemOne(raw), latencyMs, request: body, raw }
}

/**
 * POST a JSON body to OpenRouter with the retry, timeout and abort handling
 * every upstream call here needs, returning the raw parsed body and the round
 * trip that produced it.
 *
 * Shared by the decision endpoint and the chat proxy because the transport
 * concerns are identical — only the URL, the body and how the reply is read
 * differ, and those belong to the callers.
 */
async function postJson(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ raw: unknown; latencyMs: number }> {
  const startedAt = performance.now()

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // One timeout per attempt, linked to the caller's signal so an abort from
    // upstream cancels the in-flight fetch rather than just being ignored.
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(url, {
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

    return {
      raw: await response.json(),
      latencyMs: Math.round(performance.now() - startedAt),
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

export interface ChatCallResult {
  /** The parsed structured object the model returned, still to be validated. */
  content: Record<string, unknown>
  usage: JevUsage
  latencyMs: number
  /** The model OpenRouter actually served, which can differ from the request. */
  model: string
  request: unknown
  raw: unknown
}

/**
 * Ask an ordinary chat model for one structured answer, for the measured
 * baseline comparison.
 *
 * `temperature: 0` and strict `json_schema` output make the reply a JSON object
 * rather than prose, so there is no free-text parse step — the baseline is held
 * to the same "typed answer" bar as Jev. `usage.include` asks OpenRouter to
 * return the real cost, which is the only cost figure the card is allowed to
 * show. Output tokens are the expensive half here, so `max_tokens` is capped.
 */
export async function askChat(
  model: string,
  system: string,
  user: string,
  schema: StructuredSchema,
  signal?: AbortSignal,
): Promise<ChatCallResult> {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: schema },
    max_tokens: MAX_CHAT_TOKENS,
    temperature: 0,
    usage: { include: true },
  }
  const { raw, latencyMs } = await postJson(CHAT_URL, body, signal)
  const { content, usage, model: served } = parseChat(raw, model)
  return { content, usage, latencyMs, model: served, request: body, raw }
}

/**
 * Pull the structured object and the real usage out of a completions reply.
 *
 * A 2xx that is missing its content or whose content is not JSON is a provider
 * failure like any other, not a caller bug, so it surfaces as `ProviderError`
 * rather than crashing a component several frames later.
 */
function parseChat(
  raw: unknown,
  requested: string,
): { content: Record<string, unknown>; usage: JevUsage; model: string } {
  if (typeof raw !== "object" || raw === null) {
    throw new ProviderError("OpenRouter returned a non-object chat body")
  }
  const candidate = raw as {
    choices?: Array<{ message?: { content?: unknown } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
    model?: string
  }

  const message = candidate.choices?.[0]?.message?.content
  if (typeof message !== "string") {
    const preview = JSON.stringify(raw).slice(0, 300)
    throw new ProviderError(`Chat reply carried no message content: ${preview}`)
  }

  let content: unknown
  try {
    content = JSON.parse(message)
  } catch {
    throw new ProviderError(`Chat content was not JSON: ${message.slice(0, 300)}`)
  }
  if (typeof content !== "object" || content === null) {
    throw new ProviderError("Chat content was not a JSON object")
  }

  const u = candidate.usage ?? {}
  return {
    content: content as Record<string, unknown>,
    usage: {
      input_tokens: Number(u.prompt_tokens ?? 0),
      output_tokens: Number(u.completion_tokens ?? 0),
      cost: Number(u.cost ?? 0),
    },
    model: candidate.model ?? requested,
  }
}
