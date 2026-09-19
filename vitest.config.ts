import path from "node:path"

import { defineConfig } from "vitest/config"

/**
 * Unit tests, kept in their own config.
 *
 * Separate from `vite.config.ts` rather than merged into it because importing
 * `defineConfig` from `vitest/config` there pulls in vitest's bundled Vite
 * types, which then disagree with the installed Vite's `Plugin` type and break
 * `tsc`. The app config stays pure Vite; this one owns the runner.
 *
 * The two suites divide the work: vitest covers the pure policy functions,
 * Playwright (`e2e/`, its own config) covers the running app. `exclude` keeps
 * this one from collecting the Playwright specs, which it cannot run.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "server/**/*.test.ts",
      "shared/**/*.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
})
