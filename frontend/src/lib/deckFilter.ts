import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { DeckCard, OwnState } from './decks'

/** The Deck tab's search and filters (spec 006, AC-5 to AC-7). Values match the stats charts (AC-17). */
export type DeckFilter = {
  q: string
  color: string[] // W U B R G, C = colorless
  type: string[]
  mv: string[] // '0' … '6', '7+'; lands have no mana value here
  rarity: string[]
  set: string[]
  category: string[]
  own: OwnState[]
}
export const LIST_KEYS = ['color', 'type', 'mv', 'rarity', 'set', 'category', 'own'] as const
export type ListKey = (typeof LIST_KEYS)[number]

export const emptyFilter = (): DeckFilter => ({ q: '', color: [], type: [], mv: [], rarity: [], set: [], category: [], own: [] })

const list = (v: unknown) => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String).filter(Boolean)

export function filterFromQuery(query: LocationQuery): DeckFilter {
  const f = emptyFilter()
  f.q = list(query.q)[0] ?? ''
  for (const key of LIST_KEYS) (f[key] as string[]) = list(query[key])
  return f
}

/** Query keys for a filter; empty ones are removed. */
export function filterToQuery(f: Partial<DeckFilter>): LocationQueryRaw {
  const out: LocationQueryRaw = {}
  if ('q' in f) out.q = f.q || undefined
  for (const key of LIST_KEYS) if (key in f) out[key] = f[key]?.length ? f[key] : undefined
  return out
}

/** Every filter key cleared, for replacing all filters at once (AC-17). */
export const clearedQuery = (): LocationQueryRaw => filterToQuery(emptyFilter())

export const activeCount = (f: DeckFilter) => LIST_KEYS.reduce((n, key) => n + f[key].length, 0)

export const isLand = (card: DeckCard) => (card.printing.types ?? []).includes('Land')

/** The curve bucket of a nonland card. */
export function manaValueBucket(card: DeckCard): string | null {
  if (isLand(card)) return null
  const mv = Math.floor(Number(card.printing.cmc))
  return mv >= 7 ? '7+' : String(mv)
}

export function matchesColor(card: DeckCard, colors: string[]) {
  const own = card.printing.colors ?? []
  return colors.some((c) => (c === 'C' ? own.length === 0 : own.includes(c)))
}

/** Each field matches any of its values; fields combine with AND. */
export function matches(card: DeckCard, f: DeckFilter): boolean {
  const p = card.printing
  if (f.q && !p.name.toLowerCase().includes(f.q.trim().toLowerCase())) return false
  if (f.color.length && !matchesColor(card, f.color)) return false
  if (f.type.length && !f.type.some((t) => (p.types ?? []).includes(t))) return false
  if (f.mv.length && !f.mv.includes(manaValueBucket(card) ?? '')) return false
  if (f.rarity.length && !f.rarity.includes(p.rarity)) return false
  if (f.set.length && !f.set.includes(p.set_code)) return false
  if (f.category.length && !f.category.some((c) => card.categories.some((own) => own.toLowerCase() === c.toLowerCase()))) return false
  if (f.own.length && !f.own.includes(card.ownership.state as OwnState)) return false
  return true
}
