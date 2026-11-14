import type { Schemas } from '@/api/client'

/** Products to buy (spec 030). */
export type CardsChoice = 'missing' | 'all'
export type PrintingChoice = 'any' | 'chosen'
export type SinceChoice = '0' | '1' | '2' | '3' | '4'

export const CARDS_CHOICES: { value: CardsChoice; label: string }[] = [
  { value: 'missing', label: 'Missing' },
  { value: 'all', label: 'All cards' },
]
export const PRINTING_CHOICES: { value: PrintingChoice; label: string }[] = [
  { value: 'any', label: 'Any printing' },
  { value: 'chosen', label: 'Chosen printing' },
]
export const SINCE_CHOICES: { value: SinceChoice; label: string }[] = [
  { value: '0', label: 'Any year' },
  { value: '1', label: 'Last year' },
  { value: '2', label: 'Last 2 years' },
  { value: '3', label: 'Last 3 years' },
  { value: '4', label: 'Last 4 years' },
]

/** "8%", "0.7%", "<0.1%" (spec 030, AC-4). */
export function chanceLabel(chance: number): string {
  const pct = chance * 100
  if (pct >= 99.95) return '100%'
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 0.1) return `${pct.toFixed(1)}%`
  return pct > 0 ? '<0.1%' : '0%'
}

export const productYear = (p: Pick<Schemas['Product'], 'released_at'>) => (p.released_at ? p.released_at.slice(0, 4) : '')
