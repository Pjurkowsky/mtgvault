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
