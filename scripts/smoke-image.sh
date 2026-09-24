#!/usr/bin/env bash
set -euo pipefail

image=${1:?usage: scripts/smoke-image.sh <image>}
container=""

cleanup() {
  status=$?
  if [[ -n "$container" ]]; then
    if [[ $status -ne 0 ]]; then
      docker logs "$container" >&2 || true
    fi
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

container=$(docker run --detach \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --user 1000:1000 \
  --memory 256m \
  --pids-limit 64 \
  --publish 127.0.0.1::8080 \
  "$image")

port=$(docker inspect \
  --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' \
  "$container")
base="http://127.0.0.1:${port}"

for _ in $(seq 1 30); do
  if [[ $(curl --silent --output /tmp/jev-health-body --write-out '%{http_code}' \
    "$base/healthz" || true) == 200 ]]; then
    break
  fi
  sleep 1
done

[[ $(cat /tmp/jev-health-body) == "ok" ]]
curl --fail --silent --show-error "$base/" | grep -q '<div id="root">'
curl --fail --silent --show-error "$base/method" | grep -q '<div id="root">'
curl --fail --silent --show-error "$base/api/health" \
  | grep -q '"mode":"fixture"'

api_status=$(curl --silent --output /tmp/jev-api-body \
  --dump-header /tmp/jev-api-headers --write-out '%{http_code}' \
  "$base/api/not-a-route")
[[ $api_status == 404 ]]
grep -qi '^content-type: application/json' /tmp/jev-api-headers

started=$SECONDS
docker stop --time 5 "$container" >/dev/null
elapsed=$((SECONDS - started))
exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$container")
[[ $elapsed -lt 6 ]]
[[ $exit_code == 0 ]]
