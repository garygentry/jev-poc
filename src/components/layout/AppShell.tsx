import { NavLink, Outlet, Link } from "react-router-dom"
import { Moon, RotateCcw, Sun, Zap } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UsageReadout } from "@/components/jev/Readouts"
import { demos } from "@/demos/registry"
import { useSpend } from "@/lib/spend-context"
import { cn } from "@/lib/utils"

export function AppShell() {
  return (
    <div className="min-h-dvh bg-plane">
      <Header />
      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-6 sm:px-6">
        <DemoNav />
        <main className="min-w-0 flex-1 pb-20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Header() {
  const { mode, model, spend, clear } = useSpend()

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-plane/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="size-4 text-[var(--mark)]" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Jev POC</span>
        </Link>

        <NavLink
          to="/method"
          className={({ isActive }) =>
            cn(
              "text-sm transition-colors",
              isActive
                ? "font-medium text-ink"
                : "text-ink-secondary hover:text-ink",
            )
          }
        >
          Method
        </NavLink>

        <Badge variant={mode === "live" ? "good" : "default"} className="font-mono">
          {mode === "live" ? "live" : mode === "fixture" ? "fixture mode" : "…"}
        </Badge>
        <span className="hidden font-mono text-[11px] text-ink-muted sm:inline">
          {model}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <UsageReadout usage={spend} calls={spend.calls} />
          {spend.calls > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void clear()}
              title="Reset the session spend counter"
            >
              <RotateCcw />
              <span className="sr-only">Reset spend</span>
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

const THEME_KEY = "jev-poc:theme"

/**
 * Dark by default, because the instrument reads better there — but the light
 * steps are selected and validated, not an automatic inversion of the dark ones.
 *
 * The choice is remembered per browser. Storage can throw or come back empty in
 * a private window or with site data blocked, so both ends are guarded and the
 * component renders correctly without it.
 */
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return window.localStorage.getItem(THEME_KEY) !== "light"
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    try {
      window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light")
    } catch {
      // A remembered theme is a convenience, not state the app depends on.
    }
  }, [dark])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

function DemoNav() {
  return (
    <nav className="sticky top-[73px] hidden h-fit w-56 shrink-0 lg:block">
      <p className="px-3 pb-2 text-[11px] uppercase tracking-wide text-ink-muted">
        Demos
      </p>
      <ol className="space-y-0.5">
        {demos.map((demo, index) => (
          <li key={demo.slug}>
            <NavLink
              to={`/demo/${demo.slug}`}
              className={({ isActive }) =>
                cn(
                  "flex items-baseline gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-[var(--surface-raised)] font-medium text-ink"
                    : "text-ink-secondary hover:bg-[var(--surface-raised)] hover:text-ink",
                )
              }
            >
              <span className="tabular text-[11px] text-ink-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate">{demo.title}</span>
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  )
}
