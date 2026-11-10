import type { Schemas } from '@/api/client'

/** Binder pages, slots and scan order (spec 007). Pages, rows and columns count from 1. */
export type Binder = Schemas['Binder'] | Schemas['PublicBinder']
export type BinderSlot = Schemas['BinderSlot']
export type Place = { page: number; row: number; col: number }
export type Direction = 'rows' | 'columns'

/** The last binder state per binder, so switching views shows it at once (spec 009, AC-2). */
export const binderCache = new Map<string, Binder>()

/** Pocket width per card size, in rem (spec 009 AC-4, spec 021 AC-3). */
export const POCKET_REM = { sm: 5, md: 7, lg: 9.5 } as const

/**
 * S, M, L: the largest pocket each reaches; smaller when the window can't hold it (spec 023,
 * AC-7, AC-8). Fit is gone; a saved 'fit' isn't allowed, so it falls back to M.
 */
export type BinderSize = keyof typeof POCKET_REM
export const BINDER_SIZES = ['sm', 'md', 'lg'] as const

/** A page's width in px: its pockets, the 0.5rem gaps, 0.75rem padding and the border. */
export function pageWidth(cols: number, pocketRem: number) {
  return 16 * (cols * pocketRem + (cols - 1) * 0.5 + 1.5) + 2
}

/** Space between facing pages, px. */
export const PAGE_GAP = 12

/** The widest pocket (rem) with which `pages` pages fit `width` px across. */
export function fitWidth(cols: number, pages: number, width: number) {
  const page = (width - (pages - 1) * PAGE_GAP) / pages
  return ((page - 2) / 16 - 1.5 - (cols - 1) * 0.5) / cols
}

/** The tallest pocket (rem) with which a page fits `height` px: border, padding, header line and gaps. */
export function fitHeight(rows: number, height: number) {
  const pocketHeight = ((height - 2) / 16 - 1.5 - 1 - 0.5 - (rows - 1) * 0.5) / rows
  return (pocketHeight * 488) / 680
}

/** Pagination entries (AC-6): every view's label, or '…' between far ones. */
export function paginate(all: (number | null)[][], current: number): ({ index: number; label: string } | null)[] {
  const label = (v: (number | null)[]) => v.filter((p) => p !== null).join('–')
  const keep = (i: number) => i === 0 || i === all.length - 1 || Math.abs(i - current) <= 1
  const out: ({ index: number; label: string } | null)[] = []
  all.forEach((v, i) => {
    if (keep(i)) out.push({ index: i, label: label(v) })
    else if (out[out.length - 1] !== null) out.push(null)
  })
  return out
}

export const placeKey = (p: Place) => `${p.page}-${p.row}-${p.col}`
export const samePlace = (a: Place, b: Place) => a.page === b.page && a.row === b.row && a.col === b.col

/** Slots are numbered left to right, top to bottom on each page. */
export const slotNumber = (p: Place, cols: number) => (p.row - 1) * cols + p.col

export function placeOf(page: number, slot: number, cols: number): Place {
  return { page, row: Math.floor((slot - 1) / cols) + 1, col: ((slot - 1) % cols) + 1 }
}

/**
 * What one view shows. Spreads follow a real binder: page 1 alone on the right,
 * then 2–3, 4–5 … (AC-3). `null` is the empty left side of the first spread.
 */
export function views(pageCount: number, spread: boolean): (number | null)[][] {
  const out: (number | null)[][] = []
  if (!spread) {
    for (let p = 1; p <= pageCount; p++) out.push([p])
    return out
  }
  out.push([null, 1])
  for (let p = 2; p <= pageCount; p += 2) out.push(p + 1 <= pageCount ? [p, p + 1] : [p, null])
  return out
}

export function viewIndexOf(page: number, spread: boolean) {
  return spread ? Math.floor(page / 2) : page - 1
}

/** The pocket after `p` in scan order (AC-20). */
export function nextPlace(p: Place, rows: number, cols: number, direction: Direction): Place {
  if (direction === 'columns') {
    if (p.row < rows) return { ...p, row: p.row + 1 }
    if (p.col < cols) return { ...p, row: 1, col: p.col + 1 }
  } else {
    if (p.col < cols) return { ...p, col: p.col + 1 }
    if (p.row < rows) return { ...p, col: 1, row: p.row + 1 }
  }
  return { page: p.page + 1, row: 1, col: 1 }
}

/** Slots per pocket, top card first. */
export function pockets(slots: BinderSlot[]): Map<string, BinderSlot[]> {
  const out = new Map<string, BinderSlot[]>()
  for (const s of slots) {
    const key = placeKey(s)
    out.set(key, [...(out.get(key) ?? []), s])
  }
  for (const list of out.values()) list.sort((a, b) => b.position - a.position)
  return out
}

export function sectionOf(page: number, sections: Binder['sections']) {
  return sections.find((s) => s.first_page <= page && page <= s.last_page) ?? null
}

/** "Page 3 · slot 5" (AC-22). */
export const placeLabel = (p: Place, cols: number) => `Page ${p.page} · slot ${slotNumber(p, cols)}`
