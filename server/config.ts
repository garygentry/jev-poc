import { config as loadEnv } from "dotenv"

import { CHAT_PRICES } from "@shared/baseline.ts"
import type { ServerMode } from "@shared/jev.ts"

import { readAccessConfig } from "./access.ts"

loadEnv()

/**
 * OpenRouter serves decision models here, not on `/chat/completions`, which
 * rejects them outright. The path is still under `/api/alpha/` and may move, so
 * it stays overridable from `.env` without a code change.
 */
const DEFAULT_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
const DEFAULT_MODEL = "typesafe/jev-1.13"

/**
 * Ordinary chat models are served on the standard completions path, unlike the
 * decision models above. This is where the measured baseline spends its money.
 */
const DEFAULT_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

export const PORT = Number(process.env.PORT ?? 8787)
export const ACCESS_CONFIG = readAccessConfig()
export const API_KEY = (process.env.OPENROUTER_API_KEY ?? "").trim()
export const MODEL = (process.env.JEV_MODEL ?? "").trim() || DEFAULT_MODEL
export const DECISIONS_URL =
  (process.env.JEV_DECISIONS_URL ?? "").trim() || DEFAULT_DECISIONS_URL
export const CHAT_URL =
  (process.env.JEV_CHAT_URL ?? "").trim() || DEFAULT_CHAT_URL

/**
 * The only chat models `/api/chat` will call.
 *
 * The client derives the request but does not get to name an arbitrary model —
 * an open proxy to any model on OpenRouter is exactly how a demo turns into a
 * surprise bill. The allowlist is the priced set, and nothing else is served.
 */
export const CHAT_MODELS: ReadonlySet<string> = new Set(Object.keys(CHAT_PRICES))

/**
 * Hard ceiling on a baseline completion's output tokens.
 *
 * The structured objects these demos ask for are a handful of fields; a few
 * hundred tokens is generous. It is capped anyway because output is the
 * expensive half on a chat model, and a runaway generation is the one failure
 * that costs real money before anyone notices.
 */
export const MAX_CHAT_TOKENS = 512

/** Without a key we serve seeded fixtures rather than failing every request. */
export const MODE: ServerMode = API_KEY ? "live" : "fixture"

/** Hard ceiling on fan-out width. A runaway loop is still a runaway loop. */
export const MAX_CONCURRENCY = 8

/** Hard ceiling on rows per batch run, enforced server-side. */
export const MAX_BATCH_ITEMS = 200

export const REQUEST_TIMEOUT_MS = 30_000

/**
 * Statuses a second identical request could plausibly answer: timeouts, rate
 * limiting, and the gateway errors a hosted service emits transiently. Every
 * other 4xx means the request itself is wrong, and retrying only costs money.
 */
export const RETRY_STATUSES = new Set([
  408, 429, 500, 502, 503, 504, 520, 521, 522, 524,
])

/** Total attempts, not retries after the first. */
export const MAX_ATTEMPTS = 3
export const BACKOFF_MS = 400
