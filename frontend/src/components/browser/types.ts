import type { Schemas } from '@/api/client'

/** A want list entry (spec 010): no condition or language, a finish that may be Any. */
export type WantRow = Schemas['Want']

/**
 * A row in the card browser: owner rows have extra fields, public rows don't.
 * Want list rows are shaped like this too, with the entry itself in `want`.
 */
export type BrowserRow = Schemas['PublicItem'] & Partial<Omit<Schemas['Item'], keyof Schemas['PublicItem']>> & {
  want?: WantRow | Schemas['PublicWant']
  /** Opened from this binder pocket: edit and delete touch only its copy (spec 018). */
  pocket?: number
}

export type BrowserSource =
  | { kind: 'own' }
  | { kind: 'public'; username: string; locationId: number }
  /** The want list (spec 010). */
  | { kind: 'wants' }
  /** Someone's public want list (spec 010, AC-18). */
  | { kind: 'public-wants'; username: string }

/** A want entry as a browser row: Any finish shows as non-foil only where a finish must be given. */
export function wantRow(want: WantRow | Schemas['PublicWant']): BrowserRow {
  return {
    id: want.id, printing: want.printing, quantity: want.quantity,
    finish: want.finish === 'any' ? 'nonfoil' : want.finish, condition: 'NM', language: 'en',
    unit_price: want.unit_price, unit_prices: want.unit_prices, want,
  }
}
