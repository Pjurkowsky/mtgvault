import type { Ref } from 'vue'

const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/**
 * Arrow keys move focus between the cards inside `container` (elements with `data-deck-card`),
 * to the nearest one in that direction on screen; Enter clicks the focused card (spec 006, AC-9).
 */
export function useCardNavigation(container: Ref<HTMLElement | null>) {
  function onKeydown(event: KeyboardEvent) {
    const dir = KEYS[event.key]
    if (!dir || !container.value) return
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, [role="menu"], [role="listbox"]')) return
    const cards = [...container.value.querySelectorAll<HTMLElement>('[data-deck-card]')]
    if (!cards.length) return
    event.preventDefault()
    const current = target.closest<HTMLElement>('[data-deck-card]')
    if (!current) return cards[0]!.focus()
    const from = current.getBoundingClientRect()
    const ahead = cards.filter((card) => card !== current && along(from, card.getBoundingClientRect(), dir) > 1)
    // Stay in the same column (up/down) or row (left/right) when there is a card there.
    const inLine = ahead.filter((card) => overlaps(from, card.getBoundingClientRect(), dir))
    const pool = inLine.length ? inLine : ahead
    let best: HTMLElement | null = null
    let bestScore = Infinity
    for (const card of pool) {
      const to = card.getBoundingClientRect()
      const score = along(from, to, dir) + across(from, to, dir) * 3
      if (score < bestScore) [best, bestScore] = [card, score]
    }
    best?.focus()
    best?.scrollIntoView({ block: 'nearest' })
  }
  return { onKeydown }
}

const mid = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
const along = (a: DOMRect, b: DOMRect, [dx, dy]: [number, number]) => (mid(b).x - mid(a).x) * dx + (mid(b).y - mid(a).y) * dy
const across = (a: DOMRect, b: DOMRect, [dx, dy]: [number, number]) =>
  Math.abs((mid(b).x - mid(a).x) * dy) + Math.abs((mid(b).y - mid(a).y) * dx)
/** Do the two boxes share a column (moving up/down) or a row (moving left/right)? */
const overlaps = (a: DOMRect, b: DOMRect, [dx]: [number, number]) =>
  dx === 0 ? a.left < b.right && b.left < a.right : a.top < b.bottom && b.top < a.bottom
