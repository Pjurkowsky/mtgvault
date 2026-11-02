import type { Currency } from '@/lib/currency'

export type Money = { USD: number | null; EUR: number | null; PLN: number | null }

const formatters = new Map<string, Intl.NumberFormat>()

/** "$1.23", "€1.23", "PLN 5.41", or "–" when there is no price. */
export function formatMoney(value: number | null | undefined, currency: Currency | string): string {
  if (value === null || value === undefined) return '–'
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  return formatter.format(value)
}

export const PLN_ESTIMATE = 'PLN is an estimate, converted from EUR at the daily NBP rate.'
