import type { Schemas } from '@/api/client'

export type DeckDetail = Schemas['DeckDetail']
export type DeckCard = Schemas['DeckCard']
export type DeckSummary = Schemas['DeckSummary']
export type Zone = 'commander' | 'main' | 'side' | 'maybe'
export type OwnState = 'in_box' | 'owned' | 'other_decks' | 'missing'

export const FORMATS = [
  { value: 'commander', label: 'Commander', commander: true },
  { value: 'brawl', label: 'Brawl', commander: true },
  { value: 'standard', label: 'Standard', commander: false },
  { value: 'pioneer', label: 'Pioneer', commander: false },
  { value: 'modern', label: 'Modern', commander: false },
  { value: 'legacy', label: 'Legacy', commander: false },
  { value: 'vintage', label: 'Vintage', commander: false },
  { value: 'pauper', label: 'Pauper', commander: false },
  { value: 'casual', label: 'Casual', commander: false },
] as const
export const formatLabel = (value: string) => FORMATS.find((f) => f.value === value)?.label ?? value
export const hasCommander = (format: string) => FORMATS.find((f) => f.value === format)?.commander ?? false

export const ZONE_LABELS: Record<Zone, string> = { commander: 'Commander', main: 'Mainboard', side: 'Sideboard', maybe: 'Maybeboard' }

/** Zones this format has (spec 004, AC-8). */
export function zonesFor(format: string): Zone[] {
  return hasCommander(format) ? ['commander', 'main', 'maybe'] : format === 'casual' ? ['main', 'side', 'maybe'] : ['main', 'side', 'maybe']
}

/** Zones a card may go to: the Commander zone only for cards that can lead the format (spec 005, AC-5). */
export function zonesForCard(format: string, printing: { can_command: { commander: boolean; brawl: boolean } } | null): Zone[] {
  const zones = zonesFor(format)
  const leads = format === 'commander' || format === 'brawl' ? printing?.can_command[format] : false
  return leads ? zones : zones.filter((z) => z !== 'commander')
}

export const OWN_STATES: Record<OwnState, { label: string; dot: string }> = {
  in_box: { label: 'In deck box', dot: 'bg-emerald-500' },
  owned: { label: 'Owned', dot: 'bg-sky-500' },
  other_decks: { label: 'In other decks', dot: 'bg-amber-500' },
  missing: { label: 'Missing', dot: 'bg-red-500' },
}

const TYPE_ORDER = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land']
const COLOR_NAMES: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }

export type GroupBy = 'type' | 'mana_value' | 'color'
export type SortBy = 'name' | 'mana_value' | 'price'

export type Group = { key: string; label: string; cards: DeckCard[]; count: number }

function groupKey(card: DeckCard, by: GroupBy): [string, number] {
  const p = card.printing
  const types = p.types ?? []
  if (by === 'type') {
    const index = TYPE_ORDER.findIndex((t) => types.includes(t))
    return index === -1 ? ['Other', 99] : [TYPE_ORDER[index] === 'Sorcery' ? 'Sorceries' : `${TYPE_ORDER[index]}s`, index]
  }
  if (by === 'mana_value') {
    if (types.includes('Land')) return ['Lands', 99]
    const mv = Math.floor(Number(p.cmc))
    return mv >= 7 ? ['7+', 7] : [String(mv), mv]
  }
  const colors = p.colors ?? []
  if (colors.length > 1) return ['Multicolor', 6]
  if (colors.length === 0) return [types.includes('Land') ? 'Lands' : 'Colorless', types.includes('Land') ? 8 : 7]
  return [COLOR_NAMES[colors[0]!] ?? colors[0]!, 'WUBRG'.indexOf(colors[0]!)]
}

/** Moxfield-style sections: Commander first, mainboard grouped, then Sideboard and Maybeboard (AC-18, AC-19). */
export function groupDeck(cards: DeckCard[], by: GroupBy, sort: SortBy): Group[] {
  const sorter = (a: DeckCard, b: DeckCard) => {
    if (sort === 'mana_value') return Number(a.printing.cmc) - Number(b.printing.cmc) || a.printing.name.localeCompare(b.printing.name)
    if (sort === 'price') return (b.price ?? -1) - (a.price ?? -1) || a.printing.name.localeCompare(b.printing.name)
    return a.printing.name.localeCompare(b.printing.name)
  }
  const make = (key: string, label: string, list: DeckCard[]): Group => ({
    key, label, cards: [...list].sort(sorter), count: list.reduce((n, c) => n + c.quantity, 0),
  })
  const groups: Group[] = []
  const commanders = cards.filter((c) => c.zone === 'commander')
  if (commanders.length) groups.push(make('commander', 'Commander', commanders))
  const buckets = new Map<string, { order: number; cards: DeckCard[] }>()
  for (const card of cards.filter((c) => c.zone === 'main')) {
    const [label, order] = groupKey(card, by)
    const bucket = buckets.get(label) ?? { order, cards: [] }
    bucket.cards.push(card)
    buckets.set(label, bucket)
  }
  for (const [label, bucket] of [...buckets.entries()].sort((a, b) => a[1].order - b[1].order)) {
    groups.push(make(`main-${label}`, label, bucket.cards))
  }
  for (const zone of ['side', 'maybe'] as const) {
    const list = cards.filter((c) => c.zone === zone)
    if (list.length) groups.push(make(zone, ZONE_LABELS[zone], list))
  }
  return groups
}
