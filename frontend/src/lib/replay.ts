import type { Schemas } from '@/api/client'

type Board = Schemas['BoardSeat'][]
type Card = Schemas['BoardCard']

/** What changed at a step, per seat (spec 026, AC-7, AC-8). */
export type Changes = { ghosts: { card: Card; index: number }[]; newGraveyard: Set<number> }

const ids = (cards: { id: number }[] | null | undefined) => new Set((cards ?? []).map((c) => c.id))

/**
 * Compares a board with the one before it: permanents that left the battlefield for a
 * graveyard (a token that died is gone from every zone), and cards new in each graveyard.
 */
export function changes(before: Board | null, now: Board | null): Changes[] {
  if (!now) return []
  if (!before) return now.map(() => ({ ghosts: [], newGraveyard: new Set() }))
  const onField = new Set(now.flatMap((s) => s.battlefield.map((c) => c.id)))
  const graveyards = new Set(now.flatMap((s) => s.graveyard.map((c) => c.id)))
  const anywhere = new Set(now.flatMap((s) => [
    ...s.battlefield, ...s.graveyard, ...s.exile, ...s.command, ...(s.hand_cards ?? []), ...(s.library_cards ?? []),
  ].map((c) => c.id)))
  return now.map((seat, i) => {
    const old = before[i]
    const field = old?.battlefield ?? []
    // Its place in its row then, so it stays where it was.
    const ghosts = field
      .map((card) => ({ card, index: field.filter((c) => (c.row ?? 'other') === (card.row ?? 'other')).indexOf(card) }))
      .filter(({ card }) => !onField.has(card.id) && (graveyards.has(card.id) || (card.token && !anywhere.has(card.id))))
    const was = ids(old?.graveyard)
    return { ghosts, newGraveyard: new Set(seat.graveyard.filter((c) => !was.has(c.id)).map((c) => c.id)) }
  })
}

/** A piece of an event's text: plain, or a card name (spec 026, AC-14). */
export type Segment = { text: string; card?: string }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits event texts into plain text and card names. Player (deck) names are matched first, so
 * "Krenko Forest" isn't read as the card Forest. A card's game id, "Forest (72)", stays with its name.
 */
export function eventSplitter(cards: string[], players: string[]) {
  const all = [...players.map((p) => ({ p, card: false })), ...cards.map((p) => ({ p, card: true }))]
    .filter((x) => x.p.length > 1)
    .sort((a, b) => b.p.length - a.p.length)
  if (!all.length) return (text: string): Segment[] => [{ text }]
  const isCard = new Map(all.map((x) => [x.p, x.card] as const))
  const re = new RegExp(`(?<![\\w'])(${all.map((x) => escape(x.p)).join('|')})(?![\\w'])( \\(\\d+\\))?`, 'g')
  return (text: string): Segment[] => {
    const out: Segment[] = []
    let last = 0
    for (const m of text.matchAll(re)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) })
      out.push(isCard.get(m[1]!) ? { text: m[0], card: m[1] } : { text: m[0] })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last) })
    return out
  }
}

/**
 * Why a card died: the turn's events up to now that name it by its game id, the last three,
 * without its own move to the graveyard (spec 026, AC-15). Empty when nothing named it.
 */
export function deathReason(events: { text: string; type: string }[], id: number): string[] {
  const tag = `(${id})`
  return events.filter((e) => e.text.includes(tag) && !(e.type === 'ZONE_CHANGE' && e.text.includes('put into Graveyard'))).slice(-3).map((e) => e.text)
}

/** A counter's label: P/T counters add up ("+1/+1" ×2 → "+2/+2"); others show how many (spec 026, AC-17). */
export function counterLabel(type: string, n: number): string {
  const pt = /^([+-])(\d+)\/([+-])(\d+)$/.exec(type)
  if (pt) return `${pt[1]}${Number(pt[2]) * n}/${pt[3]}${Number(pt[4]) * n}`
  return n > 1 ? `${n} ${type}` : type
}
