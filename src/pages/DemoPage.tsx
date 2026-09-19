import { Suspense } from "react"
import { Link, useParams } from "react-router-dom"

import { DemoBoundary } from "@/components/layout/DemoBoundary"
import { demoBySlug } from "@/demos/registry"

export function DemoPage() {
  const { slug } = useParams()
  const demo = slug ? demoBySlug(slug) : undefined

  if (!demo) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-ink-secondary">No demo called “{slug}”.</p>
        <Link
          to="/"
          className="mt-2 inline-block text-sm text-[var(--mark)] underline underline-offset-2"
        >
          Back to the gallery
        </Link>
      </div>
    )
  }

  const { Component } = demo
  return (
    <DemoBoundary resetKey={demo.slug}>
      <Suspense fallback={<Loading />}>
        <Component key={demo.slug} />
      </Suspense>
    </DemoBoundary>
  )
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
      <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
    </div>
  )
}
