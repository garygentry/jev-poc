# Security

## Reporting a vulnerability

Please report security issues privately through [GitHub's private vulnerability reporting](https://github.com/garygentry/jev-poc/security/advisories/new), not in a public issue.
Include the steps to reproduce and the commit you tested against.

This is a proof-of-concept maintained on a best-effort basis, so there is no response-time guarantee, but reports are read and acknowledged.

## Handling API keys

The app reads `OPENROUTER_API_KEY` from `.env`, which is git-ignored.
The key is only ever held by the server sidecar (`server/`) and never sent to the browser.
Never commit a real key; CI runs [gitleaks](https://github.com/gitleaks/gitleaks) on every push and pull request.

## Authentication

The app does no authentication itself.
In production it sits behind the deploying host's login gate, which is the only way to reach it.
The gate passes the signed-in user as `X-Forwarded-Email`, `X-Forwarded-User` and `X-Forwarded-Groups` headers, which the app currently ignores.
