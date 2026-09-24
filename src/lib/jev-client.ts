import type {
  BatchRequest,
  BatchResponse,
  DecideRequest,
  DecideResponse,
  HealthResponse,
} from "@shared/jev.ts"

/** Surfaced to the UI as-is; the sidecar already made upstream errors legible. */
export class JevRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "JevRequestError"
  }
}

async function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const detail = await response
      .json()
      .then((json: { error?: string }) => json.error)
      .catch(() => undefined)
    throw new JevRequestError(
      detail ?? `Request failed with ${response.status}`,
      response.status,
    )
  }

  return (await response.json()) as T
}

/**
 * One state, N questions, one upstream call.
 *
 * The body is checked before it is handed to a component. The sidecar already
 * validates what the model returned, but a 200 can still arrive from something
 * in between — a dev-server hiccup, a proxy, a captive portal — and a missing
 * `answers` would otherwise surface as a render crash several frames later,
 * where nothing names the real cause.
 */
export async function decide(
  request: DecideRequest,
  signal?: AbortSignal,
): Promise<DecideResponse> {
  const body = await post<DecideResponse>("/api/jev/decide", request, signal)

  if (!body || typeof body.answers !== "object" || body.answers === null) {
    throw new JevRequestError(
      "The sidecar returned a response with no answers.",
      502,
    )
  }

  return body
}

/** N states sharing one question set, fanned out under the server's cap. */
export async function batch(
  request: BatchRequest,
  signal?: AbortSignal,
): Promise<BatchResponse> {
  const body = await post<BatchResponse>("/api/jev/batch", request, signal)

  if (!body || !Array.isArray(body.results)) {
    throw new JevRequestError(
      "The sidecar returned a batch with no results.",
      502,
    )
  }

  return body
}

export async function health(): Promise<HealthResponse> {
  const response = await fetch("/api/health")
  if (!response.ok) throw new JevRequestError("Sidecar unreachable", response.status)
  return (await response.json()) as HealthResponse
}
