import { Hono } from "hono"

import {
  CHAT_MODELS,
  MAX_BATCH_ITEMS,
  MAX_CONCURRENCY,
  MODE,
  MODEL,
} from "./config.ts"
import { mapWithConcurrency } from "./concurrency.ts"
import { replay } from "./fixtures.ts"
import { record, snapshot, sumUsage } from "./spend.ts"
import { ProviderError, askChat, askJev } from "./transport.ts"

import type { ChatRequest, ChatResponse } from "@shared/baseline.ts"
import type {
  BatchItemResult,
  BatchRequest,
  BatchResponse,
  DecideRequest,
  DecideResponse,
  HealthResponse,
} from "@shared/jev.ts"

export const api = new Hono()

api.get("/health", (c) => {
  const body: HealthResponse = {
    mode: MODE,
    model: MODE === "live" ? MODEL : "fixture (no key set)",
    spend: snapshot(),
  }
  return c.json(body)
})

api.post("/jev/spend/reset", async (c) => {
  const { reset } = await import("./spend.ts")
  reset()
  return c.json(snapshot())
})

/**
 * One state, N questions, one upstream call.
 *
 * This is the shape that makes decomposition worth doing: every question is
 * answered against the same state in parallel, so asking seven costs roughly
 * what asking one costs in wall-clock time.
 */
api.post("/jev/decide", async (c) => {
  const body = await c.req.json<DecideRequest>()

  if (!body?.questions || Object.keys(body.questions).length === 0) {
    return c.json({ error: "No questions supplied." }, 400)
  }

  if (MODE === "fixture") {
    const { response, source } = replay(
      body.fixtureKey,
      body.state,
      body.questions,
    )
    const result: DecideResponse = {
      ...response,
      // Replayed answers are not measured round trips, and reporting one would
      // be inventing a number the program never observed.
      latencyMs: 0,
      replayed: true,
      source,
      wire: {
        request: { model: MODEL, state: body.state, questions: body.questions },
        response,
      },
    }
    return c.json(result)
  }

  try {
    const call = await askJev(body.state, body.questions, c.req.raw.signal)
    record(call.response.usage)
    const result: DecideResponse = {
      ...call.response,
      latencyMs: call.latencyMs,
      replayed: false,
      source: "live",
      wire: { request: call.request, response: call.raw },
    }
    return c.json(result)
  } catch (error) {
    return c.json({ error: describe(error) }, statusFor(error))
  }
})

/**
 * N states, one shared question set, fanned out concurrently.
 *
 * Questions batch into a single request only when they share state. Here every
 * item *is* different state, so they cannot batch — the calls fan out across a
 * bounded pool instead. Width and length are both clamped here rather than
 * trusted from the client.
 */
api.post("/jev/batch", async (c) => {
  const body = await c.req.json<BatchRequest>()

  if (!body?.items?.length) {
    return c.json({ error: "No items supplied." }, 400)
  }
  if (!body?.questions || Object.keys(body.questions).length === 0) {
    return c.json({ error: "No questions supplied." }, 400)
  }

  const items = body.items.slice(0, MAX_BATCH_ITEMS)
  const concurrency = Math.min(body.concurrency ?? MAX_CONCURRENCY, MAX_CONCURRENCY)
  const startedAt = performance.now()

  if (MODE === "fixture") {
    const results: BatchItemResult[] = items.map((item) => {
      const { response } = replay(
        body.fixtureKey ? `${body.fixtureKey}/${item.id}` : undefined,
        item.state,
        body.questions,
      )
      return { id: item.id, answers: response.answers, usage: response.usage, latencyMs: 0 }
    })
    const batch: BatchResponse = {
      results,
      usage: sumUsage(results.map((r) => r.usage)),
      wallClockMs: Math.round(performance.now() - startedAt),
      replayed: true,
      source: body.fixtureKey ? "seeded" : "synthetic",
    }
    return c.json(batch)
  }

  const settled = await mapWithConcurrency(items, concurrency, async (item) => {
    const call = await askJev(item.state, body.questions, c.req.raw.signal)
    record(call.response.usage)
    return call
  })

  const results: BatchItemResult[] = settled.map((outcome, index) => {
    const id = (items[index] as { id: string }).id
    if ("error" in outcome) return { id, error: describe(outcome.error) }
    return {
      id,
      answers: outcome.value.response.answers,
      usage: outcome.value.response.usage,
      latencyMs: outcome.value.latencyMs,
    }
  })

  const batch: BatchResponse = {
    results,
    usage: sumUsage(results.map((r) => r.usage)),
    wallClockMs: Math.round(performance.now() - startedAt),
    replayed: false,
    source: "live",
  }
  return c.json(batch)
})

/**
 * One chat completion, for the measured baseline comparison.
 *
 * The client derives the request but does not get to name the model — an open
 * proxy to any model on OpenRouter is how a demo becomes a surprise bill, so
 * anything off the allowlist is refused before a call is made. There is no
 * fixture path: a baseline is a *measured* second opinion, and a seeded one
 * would be a contradiction, so without a key the route says so plainly rather
 * than inventing an answer.
 */
api.post("/chat", async (c) => {
  const body = await c.req.json<ChatRequest>()

  if (!body?.model || !CHAT_MODELS.has(body.model)) {
    return c.json(
      { error: `Model ${JSON.stringify(body?.model)} is not on the baseline allowlist.` },
      400,
    )
  }
  if (!body.schema || !body.user) {
    return c.json({ error: "A baseline request needs a prompt and a schema." }, 400)
  }
  if (MODE === "fixture") {
    return c.json(
      { error: "The measured baseline needs a live key — it is not seeded." },
      503,
    )
  }

  try {
    const call = await askChat(
      body.model,
      body.system,
      body.user,
      body.schema,
      c.req.raw.signal,
    )
    record(call.usage)
    const result: ChatResponse = {
      model: call.model,
      content: call.content,
      usage: call.usage,
      latencyMs: call.latencyMs,
    }
    return c.json(result)
  } catch (error) {
    return c.json({ error: describe(error) }, statusFor(error))
  }
})

/**
 * Turn a failure into something worth showing a person.
 *
 * The common ones are given a plain sentence and a next step, because dumping
 * an upstream JSON envelope into the UI tells the reader what happened only if
 * they already know. Everything else falls through with its own message, which
 * is better than a generic apology.
 */
function describe(error: unknown): string {
  if (error instanceof ProviderError) {
    const detail = error.message

    if (error.status === 401 || error.status === 403) {
      // By far the most likely failure, and the one with a clear fix.
      return /expired/i.test(detail)
        ? "OpenRouter rejected the API key as expired. Generate a new one at openrouter.ai/settings/keys and restart the server."
        : "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env and restart the server."
    }

    if (error.status === 429) {
      return "Rate limited by OpenRouter. Wait a moment and try again, or reduce the fan-out."
    }

    if (error.status === 404) {
      return `The decisions endpoint was not found. It is an alpha path and may have moved — override JEV_DECISIONS_URL in .env. (${detail})`
    }

    return detail
  }

  if (error instanceof Error) return error.message
  return String(error)
}

/** Surface upstream auth and rate-limit failures as themselves, not as 500s. */
function statusFor(error: unknown): 401 | 429 | 502 {
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) return 401
    if (error.status === 429) return 429
  }
  return 502
}
