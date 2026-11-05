import { RARITIES, TYPES } from './cards'
import { isLand, manaValueBucket, type DeckFilter } from './deckFilter'
import type { DeckCard } from './decks'

/** Chart data for the Stats tab, computed from the deck's cards (spec 006, AC-16 to AC-18). */
export const COUNTED_ZONES = ['commander', 'main', 'side']
export const MANA_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7+']
export const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
export type Color = (typeof COLORS)[number]
export const COLOR_NAMES: Record<Color, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land']

/** One bar of a ranked list; `filter` is what clicking it sets on the Deck tab (AC-17). */
export type Bar = { key: string; label: string; count: number; filter: Partial<DeckFilter> }
export type CurveBar = { mv: string; creatures: number; other: number }
export type ColorRow = { color: Color; symbols: number; sources: number; symbolShare: number; sourceShare: number }

export type DeckStatsData = {
  cards: number
  lands: number
  averageNonland: number
  averageAll: number
  curve: CurveBar[]
  colors: ColorRow[]
  types: Bar[]
  categories: Bar[]
  rarities: Bar[]
  sets: Bar[]
  expensive: DeckCard[]
}

const ranked = (counts: Map<string, { label: string; count: number; filter: Partial<DeckFilter> }>) =>
  [...counts.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

/** Mana symbols of each color in a cost; hybrid symbols count for each of their colors. */
function symbolCounts(cost: string): Partial<Record<Color, number>> {
  const out: Partial<Record<Color, number>> = {}
  for (const [, symbol] of cost.matchAll(/\{([^}]+)\}/g)) {
    for (const c of COLORS) if (symbol!.split('/').includes(c)) out[c] = (out[c] ?? 0) + 1
  }
  return out
}

export function deckStats(all: DeckCard[]): DeckStatsData {
  const cards = all.filter((c) => COUNTED_ZONES.includes(c.zone))
  let total = 0, lands = 0, mvTotal = 0
  const curve = new Map(MANA_VALUES.map((mv) => [mv, { mv, creatures: 0, other: 0 }]))
  const symbols = new Map<Color, number>(COLORS.map((c) => [c, 0]))
  const sources = new Map<Color, number>(COLORS.map((c) => [c, 0]))
  const types = new Map<string, number>()
  const categories = new Map<string, { label: string; count: number; filter: Partial<DeckFilter> }>()
  const rarities = new Map<string, number>()
  const sets = new Map<string, { label: string; count: number; filter: Partial<DeckFilter> }>()

  for (const card of cards) {
    const p = card.printing, q = card.quantity
    total += q
    if (isLand(card)) lands += q
    else {
      mvTotal += Number(p.cmc) * q
      const bar = curve.get(manaValueBucket(card)!)!
      if ((p.types ?? []).includes('Creature')) bar.creatures += q
      else bar.other += q
    }
    for (const [c, n] of Object.entries(symbolCounts(p.mana_cost ?? ''))) symbols.set(c as Color, symbols.get(c as Color)! + n * q)
    for (const c of p.produced_mana ?? []) if (sources.has(c as Color)) sources.set(c as Color, sources.get(c as Color)! + q)
    for (const t of p.types ?? []) if (TYPE_ORDER.includes(t)) types.set(t, (types.get(t) ?? 0) + q)
    for (const name of card.categories) {
      const key = name.toLowerCase()
      const entry = categories.get(key) ?? { label: name, count: 0, filter: { category: [name] } }
      entry.count += q
      categories.set(key, entry)
    }
    rarities.set(p.rarity, (rarities.get(p.rarity) ?? 0) + q)
    const set = sets.get(p.set_code) ?? { label: p.set_name, count: 0, filter: { set: [p.set_code] } }
    set.count += q
    sets.set(p.set_code, set)
  }

  const symbolTotal = [...symbols.values()].reduce((a, b) => a + b, 0)
  const sourceTotal = [...sources.values()].reduce((a, b) => a + b, 0)
  const nonland = total - lands
  return {
    cards: total,
    lands,
    averageNonland: nonland ? mvTotal / nonland : 0,
    averageAll: total ? mvTotal / total : 0,
    curve: [...curve.values()],
    colors: COLORS.map((color) => ({
      color,
      symbols: symbols.get(color)!,
      sources: sources.get(color)!,
      symbolShare: symbolTotal ? symbols.get(color)! / symbolTotal : 0,
      sourceShare: sourceTotal ? sources.get(color)! / sourceTotal : 0,
    })).filter((r) => r.symbols || r.sources),
    types: TYPE_ORDER.filter((t) => types.has(t) && (TYPES as readonly string[]).includes(t))
      .map((t) => ({ key: t, label: t, count: types.get(t)!, filter: { type: [t] } })),
    categories: ranked(categories),
    rarities: RARITIES.filter((r) => rarities.has(r.value))
      .map((r) => ({ key: r.value, label: r.label, count: rarities.get(r.value)!, filter: { rarity: [r.value] } })),
    sets: ranked(sets).slice(0, 8),
    expensive: cards.filter((c) => c.price != null && c.price > 0)
      .sort((a, b) => b.price! - a.price! || a.printing.name.localeCompare(b.printing.name)).slice(0, 10),
  }
}
