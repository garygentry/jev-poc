/**
 * Discover every demo's manifest from Node.
 *
 * The browser gets the same set from `import.meta.glob` in `registry.ts`; this
 * is the half that `scripts/capture.ts` and the Playwright config need, where
 * there is no bundler and React must not be dragged in. It works only because
 * `demo.ts` is JSX-free — that constraint exists for this file.
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import type { AnyDemoManifest } from "./types"

const DEMOS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

/** Directory names that are kit infrastructure rather than demos. */
const isDemoDir = (name: string) =>
  !name.startsWith("_") &&
  statSync(path.join(DEMOS_DIR, name)).isDirectory() &&
  existsSync(path.join(DEMOS_DIR, name, "demo.ts"))

export function demoSlugs(): string[] {
  return readdirSync(DEMOS_DIR).filter(isDemoDir).sort()
}

/**
 * @param slugs Restrict to these demos, for `pnpm capture <demo>`. Unknown
 *   slugs are returned as `missing` rather than thrown, so the caller can name
 *   all of them at once instead of one per run.
 */
export async function loadManifests(
  slugs?: string[],
): Promise<{ manifests: AnyDemoManifest[]; missing: string[] }> {
  const available = demoSlugs()
  const wanted = slugs?.length ? slugs : available
  const missing = wanted.filter((slug) => !available.includes(slug))

  const manifests = await Promise.all(
    wanted
      .filter((slug) => available.includes(slug))
      .map(async (slug) => {
        const file = pathToFileURL(path.join(DEMOS_DIR, slug, "demo.ts")).href
        const module = (await import(file)) as { manifest?: AnyDemoManifest }
        if (!module.manifest) {
          throw new Error(`${slug}/demo.ts does not export a \`manifest\``)
        }
        return module.manifest
      }),
  )

  return { manifests, missing }
}
