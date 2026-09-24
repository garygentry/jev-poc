import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose"
import type { MiddlewareHandler } from "hono"

export type AccessConfig =
  | { enabled: false }
  | {
      enabled: true
      teamDomain: string
      audience: string
      jwksUrl: URL
    }

export type AccessTokenVerifier = (token: string) => Promise<void>

/** Read the Cloudflare Access settings once and fail closed on partial config. */
export function readAccessConfig(
  env: NodeJS.ProcessEnv = process.env,
): AccessConfig {
  const rawDomain = (env.CF_ACCESS_TEAM_DOMAIN ?? "").trim()
  const audience = (env.CF_ACCESS_AUD ?? "").trim()

  if (!rawDomain && !audience) return { enabled: false }
  if (!rawDomain || !audience) {
    throw new Error(
      "CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must either both be set or both be unset.",
    )
  }

  let teamDomain: URL
  try {
    teamDomain = new URL(rawDomain)
  } catch {
    throw new Error("CF_ACCESS_TEAM_DOMAIN must be a valid HTTPS URL.")
  }

  if (
    teamDomain.protocol !== "https:" ||
    teamDomain.username ||
    teamDomain.password ||
    teamDomain.search ||
    teamDomain.hash ||
    (teamDomain.pathname !== "/" && teamDomain.pathname !== "")
  ) {
    throw new Error(
      "CF_ACCESS_TEAM_DOMAIN must be an HTTPS origin without credentials, a path, query, or fragment.",
    )
  }

  const normalizedDomain = teamDomain.origin
  return {
    enabled: true,
    teamDomain: normalizedDomain,
    audience,
    jwksUrl: new URL("/cdn-cgi/access/certs", `${normalizedDomain}/`),
  }
}

/** Create the process-wide verifier. createRemoteJWKSet caches keys and refetches on rotation. */
export function createAccessTokenVerifier(
  config: Extract<AccessConfig, { enabled: true }>,
  key: JWTVerifyGetKey = createRemoteJWKSet(config.jwksUrl),
): AccessTokenVerifier {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, key, {
      audience: config.audience,
      issuer: config.teamDomain,
      algorithms: ["RS256"],
    })

    // jose validates exp when present. Access assertions are required to carry
    // it, so reject a correctly signed but non-expiring token as well.
    if (typeof payload.exp !== "number") {
      throw new joseErrors.JWTClaimValidationFailed(
        'missing required "exp" claim',
        payload,
        "exp",
        "missing",
      )
    }
  }
}

/** Gate every route except the exact external health probe. */
export function accessMiddleware(
  config: AccessConfig,
  verifier?: AccessTokenVerifier,
): MiddlewareHandler {
  if (!config.enabled) return async (_context, next) => next()

  const verify = verifier ?? createAccessTokenVerifier(config)

  return async (context, next) => {
    if (context.req.path === "/healthz") return next()

    const token = context.req.header("Cf-Access-Jwt-Assertion")?.trim()
    if (!token) return context.text("Forbidden", 403)

    try {
      await verify(token)
    } catch {
      return context.text("Forbidden", 403)
    }

    return next()
  }
}
