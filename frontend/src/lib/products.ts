import type { Schemas } from '@/api/client'
import type { CardSize } from '@/lib/cards'
import { TYPE_ORDER } from '@/lib/decks'

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

export type Section = 'precons' | 'boosters' | 'other_decks' | 'other_boosters'

/** The dialog's tabs, in order (spec 032, AC-1). */
export const SECTIONS: { value: Section; label: string }[] = [
  { value: 'precons', label: 'Precons' },
  { value: 'boosters', label: 'Boosters' },
  { value: 'other_decks', label: 'Other decks' },
  { value: 'other_boosters', label: 'Other boosters' },
]

type Printing = Schemas['Printing']

/** A product's cards by type, in the deck page's order (spec 032, AC-5). */
export function byType<T extends { printing: Printing }>(cards: T[]): { label: string; cards: T[] }[] {
  const groups = new Map<number, { label: string; cards: T[] }>()
  for (const card of cards) {
    const types = (card.printing.type_line.split('—')[0] ?? '').split(/\s+/)
    const index = TYPE_ORDER.findIndex((t) => types.includes(t))
    const label = index === -1 ? 'Other' : TYPE_ORDER[index] === 'Sorcery' ? 'Sorceries' : `${TYPE_ORDER[index]}s`
    const key = index === -1 ? 99 : index
    const group = groups.get(key) ?? { label, cards: [] }
    group.cards.push(card)
    groups.set(key, group)
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g)
}

/** Product photo grid columns per card size, sized for the dialog. */
export const PRODUCT_COLUMNS: Record<CardSize, string> = {
  sm: 'grid-cols-4 sm:grid-cols-7',
  md: 'grid-cols-3 sm:grid-cols-5',
  lg: 'grid-cols-2 sm:grid-cols-3',
}
