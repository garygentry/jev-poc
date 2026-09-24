import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose"
import { describe, expect, it, vi } from "vitest"

import {
  accessMiddleware,
  createAccessTokenVerifier,
  readAccessConfig,
  type AccessConfig,
} from "./access.ts"
import { Hono } from "hono"

const enabledConfig: Extract<AccessConfig, { enabled: true }> = {
  enabled: true,
  teamDomain: "https://team.cloudflareaccess.com",
  audience: "expected-audience",
  jwksUrl: new URL(
    "https://team.cloudflareaccess.com/cdn-cgi/access/certs",
  ),
}

describe("readAccessConfig", () => {
  it("disables Access when both settings are absent", () => {
    expect(readAccessConfig({})).toEqual({ enabled: false })
  })

  it("fails closed when only one setting is present", () => {
    expect(() =>
      readAccessConfig({ CF_ACCESS_TEAM_DOMAIN: enabledConfig.teamDomain }),
    ).toThrow(/both be set or both be unset/)
    expect(() =>
      readAccessConfig({ CF_ACCESS_AUD: enabledConfig.audience }),
    ).toThrow(/both be set or both be unset/)
  })

  it("normalizes the team origin and constructs the certs URL", () => {
    expect(
      readAccessConfig({
        CF_ACCESS_TEAM_DOMAIN: `${enabledConfig.teamDomain}/`,
        CF_ACCESS_AUD: enabledConfig.audience,
      }),
    ).toEqual(enabledConfig)
  })
})

describe("accessMiddleware", () => {
  function appWith(verifier = vi.fn(async () => undefined)) {
    const app = new Hono()
    app.use("*", accessMiddleware(enabledConfig, verifier))
    app.get("/healthz", (context) => context.text("ok"))
    app.get("/private", (context) => context.text("private"))
    return { app, verifier }
  }

  it("bypasses only the exact health route", async () => {
    const { app, verifier } = appWith()
    expect((await app.request("/healthz")).status).toBe(200)
    expect(verifier).not.toHaveBeenCalled()
    expect((await app.request("/healthz/extra")).status).toBe(403)
  })

  it("returns 403 when the assertion is missing or invalid", async () => {
    const { app } = appWith(vi.fn(async () => Promise.reject(new Error("bad"))))
    expect((await app.request("/private")).status).toBe(403)
    expect(
      (
        await app.request("/private", {
          headers: { "Cf-Access-Jwt-Assertion": "bad-token" },
        })
      ).status,
    ).toBe(403)
  })

  it("accepts a verified assertion", async () => {
    const { app, verifier } = appWith()
    const response = await app.request("/private", {
      headers: { "Cf-Access-Jwt-Assertion": "valid-token" },
    })
    expect(response.status).toBe(200)
    expect(verifier).toHaveBeenCalledWith("valid-token")
  })
})

describe("createAccessTokenVerifier", () => {
  it("checks signature, audience, issuer, and expiration", async () => {
    const validKeys = await generateKeyPair("RS256")
    const otherKeys = await generateKeyPair("RS256")
    const getValidKey: JWTVerifyGetKey = async () => validKeys.publicKey
    const getOtherKey: JWTVerifyGetKey = async () => otherKeys.publicKey
    const verify = createAccessTokenVerifier(enabledConfig, getValidKey)

    const sign = (
      audience: string,
      expiration: string,
      issuer = enabledConfig.teamDomain,
    ) =>
      new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime(expiration)
        .sign(validKeys.privateKey)

    await expect(verify(await sign(enabledConfig.audience, "5m"))).resolves.toBeUndefined()
    await expect(verify(await sign("wrong", "5m"))).rejects.toThrow()
    await expect(verify(await sign(enabledConfig.audience, "0s"))).rejects.toThrow()
    await expect(
      verify(
        await sign(enabledConfig.audience, "5m", "https://other.cloudflareaccess.com"),
      ),
    ).rejects.toThrow(/iss/)

    const wrongSignature = createAccessTokenVerifier(enabledConfig, getOtherKey)
    await expect(
      wrongSignature(await sign(enabledConfig.audience, "5m")),
    ).rejects.toThrow()

    const noExpiration = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(enabledConfig.teamDomain)
      .setAudience(enabledConfig.audience)
      .sign(validKeys.privateKey)
    await expect(verify(noExpiration)).rejects.toThrow(/exp/)
  })
})
