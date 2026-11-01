import type { Schemas } from '@/api/client'

/** A row in the card browser: owner rows have extra fields, public rows don't. */
export type BrowserRow = Schemas['PublicItem'] & Partial<Omit<Schemas['Item'], keyof Schemas['PublicItem']>>

export type BrowserSource = { kind: 'own' } | { kind: 'public'; username: string; locationId: number }
