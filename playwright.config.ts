import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests for the demo app.
 *
 * These are deliberately separate from the vitest suite. Vitest covers the pure
 * policy functions — routing, gates, beam pruning, rank bounds — which is where
 * the logic that matters lives. This suite covers the thing those tests cannot:
 * that the app actually renders, that a request reaches the sidecar and comes
 * back, and that replayed data is never presented as live.
 *
 * `webServer` starts both processes, so `pnpm e2e` works from a cold checkout.
 */
/**
 * The suite runs against **fixtures**, on its own ports, always.
 *
 * Two reasons. Asserting on live model output would be flaky by construction —
 * a re-ranking that shifts by one place is not a regression. And the suite has
 * to be runnable beside a dev server without fighting it for a port or, worse,
 * spending money on every run.
 *
 * Live mode is verified separately: `pnpm capture` re-records the fixtures, and
 * the suite then asserts against what the model actually said.
 */
const CLIENT_PORT = 5181
const SERVER_PORT = 8788

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      // The responsive suite asserts the phone layout; running it at 1280
      // would fail on things that are correct at that width.
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 800 } },
      // Layout-only checks; the per-demo behaviour is covered on desktop.
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${CLIENT_PORT}`,
    // Always a fresh server: reusing one would inherit whatever mode and ports
    // that process happened to start in, which is exactly what this config is
    // pinning down.
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      CLIENT_PORT: String(CLIENT_PORT),
      PORT: String(SERVER_PORT),
      // An empty value still counts as set, and dotenv does not overwrite what
      // is already in the environment — so this wins over .env and holds the
      // server in fixture mode whether or not a key is configured.
      OPENROUTER_API_KEY: "",
    },
  },
})
