import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[var(--hairline)] bg-[var(--surface-raised)] text-ink-secondary",
        outline: "border-[var(--hairline)] text-ink-secondary",
        mark: "border-transparent bg-[var(--mark)]/15 text-[var(--mark)]",
        // Status variants always render an icon and a word alongside the color.
        good: "border-transparent bg-[var(--status-good)]/15 text-[var(--status-good-ink)]",
        warning:
          "border-transparent bg-[var(--status-warning)]/15 text-[var(--status-warning-ink)]",
        critical:
          "border-transparent bg-[var(--status-critical)]/15 text-[var(--status-critical-ink)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
