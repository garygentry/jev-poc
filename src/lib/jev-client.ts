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

/** One state, N questions, one upstream call. */
export function decide(
  request: DecideRequest,
  signal?: AbortSignal,
): Promise<DecideResponse> {
  return post<DecideResponse>("/api/jev/decide", request, signal)
}

/** N states sharing one question set, fanned out under the server's cap. */
export function batch(
  request: BatchRequest,
  signal?: AbortSignal,
): Promise<BatchResponse> {
  return post<BatchResponse>("/api/jev/batch", request, signal)
}

export async function health(): Promise<HealthResponse> {
  const response = await fetch("/api/health")
  if (!response.ok) throw new JevRequestError("Sidecar unreachable", response.status)
  return (await response.json()) as HealthResponse
}

export async function resetSpend(): Promise<void> {
  await fetch("/api/jev/spend/reset", { method: "POST" })
}
