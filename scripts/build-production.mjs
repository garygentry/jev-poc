import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"

import { build as bundle } from "esbuild"
import { build as buildClient } from "vite"

const root = process.cwd()
const dist = path.join(root, "dist")

await rm(dist, { recursive: true, force: true })

await buildClient({
  build: {
    outDir: path.join(dist, "client"),
    emptyOutDir: false,
  },
})

await mkdir(path.join(dist, "server"), { recursive: true })
await bundle({
  entryPoints: [path.join(root, "server/index.ts")],
  outfile: path.join(dist, "server/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  sourcemap: false,
  logLevel: "info",
})

await cp(path.join(root, "fixtures"), path.join(dist, "fixtures"), {
  recursive: true,
})
