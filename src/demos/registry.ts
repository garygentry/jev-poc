import { lazy, type LazyExoticComponent, type ComponentType } from "react"

import { fansOut, type AnyDemoManifest, type DemoGroup } from "./_kit/types"

export type { DemoGroup, DemoShape, Primitive } from "./_kit/types"

export interface Demo {
  slug: string
  title: string
  tagline: string
  /** The one thing this demo exists to show. */
  thesis: string
  group: DemoGroup
  order: number
  shape: AnyDemoManifest["shape"]
  primitives: AnyDemoManifest["primitives"]
  /** True for the demos that fan out and can therefore spend real money. */
  fansOut: boolean
  Component: LazyExoticComponent<ComponentType>
}

/**
 * Adding a demo means creating a directory. Nothing here changes.
 *
 * Each `src/demos/<slug>/demo.ts` exports a JSX-free `manifest`, and each
 * `Demo.tsx` default-exports its view. Vite resolves both globs at build time,
 * so discovery costs nothing at runtime and a demo that forgets one of the two
 * files fails loudly below rather than silently disappearing from the gallery.
 *
 * What is left here is the one thing a demo cannot know about itself: where its
 * group sits in the tour.
 */
const GROUP_ORDER: DemoGroup[] = [
  "foundations",
  "control-plane",
  "cost",
  "engineering",
  "safety",
  "documents",
  "method",
]

const manifests = import.meta.glob<AnyDemoManifest>("./*/demo.ts", {
  eager: true,
  import: "manifest",
})

const views = import.meta.glob<{ default: ComponentType }>("./*/Demo.tsx")

const slugOf = (modulePath: string) => modulePath.split("/")[1]!

function discovered(): Demo[] {
  return Object.entries(manifests).map(([modulePath, manifest]) => {
    const slug = slugOf(modulePath)
    const view = views[`./${slug}/Demo.tsx`]
    if (!view) throw new Error(`demo "${slug}" has a manifest but no Demo.tsx`)
    if (manifest.slug !== slug) {
      throw new Error(
        `demo "${slug}" declares slug "${manifest.slug}" — they must match, ` +
          "because the directory name is what builds its fixture keys",
      )
    }

    return {
      slug,
      title: manifest.title,
      tagline: manifest.tagline,
      thesis: manifest.thesis,
      group: manifest.group,
      order: manifest.order,
      shape: manifest.shape,
      primitives: manifest.primitives,
      fansOut: fansOut(manifest.kind),
      Component: lazy(view),
    }
  })
}

const byTourPosition = (a: Demo, b: Demo) =>
  GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
  a.order - b.order ||
  a.slug.localeCompare(b.slug)

/**
 * Every demo, ordered as a tour.
 *
 * Each one is a different *shape*, not a different topic. Questions batch into
 * a single request only when they share state — so a demo that fans questions
 * wide and a demo that fans requests wide are teaching two genuinely different
 * things, and a set that only showed the first would miss half the model.
 */
export const demos: Demo[] = discovered().sort(byTourPosition)

export const demoBySlug = (slug: string) =>
  demos.find((demo) => demo.slug === slug)
