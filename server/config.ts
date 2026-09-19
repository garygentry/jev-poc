import { config as loadEnv } from "dotenv"

import type { ServerMode } from "@shared/jev.ts"

loadEnv()

/**
 * OpenRouter serves decision models here, not on `/chat/completions`, which
 * rejects them outright. The path is still under `/api/alpha/` and may move, so
 * it stays overridable from `.env` without a code change.
 */
const DEFAULT_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
const DEFAULT_MODEL = "typesafe/jev-1.13"

export const PORT = Number(process.env.PORT ?? 8787)
export const API_KEY = (process.env.OPENROUTER_API_KEY ?? "").trim()
export const MODEL = (process.env.JEV_MODEL ?? "").trim() || DEFAULT_MODEL
export const DECISIONS_URL =
  (process.env.JEV_DECISIONS_URL ?? "").trim() || DEFAULT_DECISIONS_URL

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
