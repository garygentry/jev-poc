#!/usr/bin/env bash
# Smoke-test a built image under the production runtime constraints:
# read-only root, tmpfs /tmp, the image's own (non-root) user, 256 MB, 64 pids.
set -euo pipefail

image=${1:?usage: scripts/smoke-image.sh <image>}
work=$(mktemp -d)
containers=()

cleanup() {
  status=$?
  for container in "${containers[@]}"; do
    if [[ $status -ne 0 ]]; then
      docker logs "$container" >&2 || true
    fi
    docker rm -f "$container" >/dev/null 2>&1 || true
  done
  rm -rf "$work"
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "smoke: $*" >&2
  exit 1
}

# Start a constrained container with extra `-e` args; sets $container and $base.
start() {
  container=$(docker run --detach \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    --memory 256m \
    --pids-limit 64 \
    --publish 127.0.0.1::8080 \
    "$@" \
    "$image")
  containers+=("$container")

  local port
  port=$(docker inspect \
    --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' \
    "$container")
  base="http://127.0.0.1:${port}"

  for _ in $(seq 1 30); do
    if [[ $(curl --silent --output "$work/health" --write-out '%{http_code}' \
      "$base/healthz" || true) == 200 ]]; then
      [[ $(cat "$work/health") == "ok" ]] || fail "/healthz body was not ok"
      return
    fi
    sleep 1
  done
  fail "/healthz never returned 200"
}

status_of() {
  curl --silent --output /dev/null --write-out '%{http_code}' "$@"
}

# The image itself must declare the non-root user; nothing here passes --user.
[[ $(docker inspect --format '{{.Config.User}}' "$image") == "1000:1000" ]] ||
  fail "image does not run as 1000:1000"

# 1. Production refuses to start ungated without an explicit opt-out.
refused=$(docker run --detach --read-only --tmpfs /tmp "$image")
containers+=("$refused")
docker wait "$refused" >/dev/null
[[ $(docker inspect --format '{{.State.ExitCode}}' "$refused") != 0 ]] ||
  fail "started without Access config or CF_ACCESS_DISABLED=1"

# 2. Fixture mode, explicitly ungated.
start -e CF_ACCESS_DISABLED=1

[[ $(docker exec "$container" id -u) == 1000 ]] || fail "process is not uid 1000"
[[ $(status_of --head "$base/healthz") == 200 ]] || fail "HEAD /healthz"
curl --fail --silent --show-error "$base/" | grep -q '<div id="root">' ||
  fail "/ is not the SPA shell"
curl --fail --silent --show-error "$base/method" | grep -q '<div id="root">' ||
  fail "/method is not the SPA shell"
curl --fail --silent --show-error "$base/api/health" |
  grep -q '"mode":"fixture"' || fail "/api/health is not in fixture mode"

# A seeded fixture proves fixtures/ resolved beside the bundled server.
curl --fail --silent --show-error "$base/api/jev/decide" \
  -H 'content-type: application/json' \
  -d '{"state":"x","questions":{"q":{"type":"noul","instructions":"x"}},"fixtureKey":"triage/stripe-payouts"}' |
  grep -q '"source":"seeded"' || fail "fixtures were not loaded"

api_status=$(curl --silent --output /dev/null \
  --dump-header "$work/api-headers" --write-out '%{http_code}' \
  "$base/api/not-a-route")
[[ $api_status == 404 ]] || fail "/api miss returned $api_status"
grep -qi '^content-type: application/json' "$work/api-headers" ||
  fail "/api miss was not JSON"
[[ $(status_of "$base/assets/missing.js") == 404 ]] ||
  fail "missing asset did not 404"

started=$SECONDS
docker stop --time 5 "$container" >/dev/null
elapsed=$((SECONDS - started))
[[ $elapsed -lt 6 ]] || fail "SIGTERM shutdown took ${elapsed}s"
[[ $(docker inspect --format '{{.State.ExitCode}}' "$container") == 0 ]] ||
  fail "non-zero exit after SIGTERM"

# 3. Access enabled: everything but /healthz needs a valid assertion.
start \
  -e CF_ACCESS_TEAM_DOMAIN=https://smoke.cloudflareaccess.com \
  -e CF_ACCESS_AUD=smoke-audience

for path in / /method /api/health; do
  [[ $(status_of "$base$path") == 403 ]] || fail "$path was not gated"
done
[[ $(status_of -H 'Cf-Access-Jwt-Assertion: bogus' "$base/api/health") == 403 ]] ||
  fail "a bogus assertion was accepted"

echo "smoke: ok"
