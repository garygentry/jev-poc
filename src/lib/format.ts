/** Display helpers. Every value passed in comes from a real response. */

export const percent = (value: number, digits = 0) =>
  `${(value * 100).toFixed(digits)}%`

export const probability = (value: number) => value.toFixed(3).replace(/^0\./, ".")

export const ms = (value: number) => `${Math.round(value)}ms`

export const tokens = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)

/**
 * Money, down to the fraction of a cent Jev actually costs.
 *
 * Rounding a $0.000019 call to "$0.00" would erase the entire point of the
 * pricing, so small amounts keep enough places to stay legible.
 */
export function usd(value: number): string {
  if (value === 0) return "$0"
  if (value < 0.01) return `$${value.toFixed(6)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

/** Turn an option key like `read_only` into `read only` for display. */
export const humanize = (key: string) => key.replace(/[_-]+/g, " ")
