import type { Currency } from '@/lib/currency'

const formatters = new Map<string, Intl.NumberFormat>()

/**
 * "$1.23", "€1.23", "≈ PLN 5.41" or "–" when there is no price.
 * PLN prices are converted from EUR, so they carry "≈" (spec 001, AC-3).
 */
export function formatMoney(value: number | null | undefined, currency: Currency | string): string {
  if (value === null || value === undefined) return '–'
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  const text = formatter.format(value)
  return currency === 'PLN' ? `≈ ${text}` : text
}

export const PLN_ESTIMATE = 'Estimate: Cardmarket EUR price converted at the daily NBP rate.'
