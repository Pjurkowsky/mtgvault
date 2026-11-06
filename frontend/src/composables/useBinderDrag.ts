import { onBeforeUnmount, ref, shallowRef } from 'vue'

/** What is being dragged: a placed card (`slot`) or one unplaced copy of a row (`item`). */
export type DragSource = { slot?: number; item?: number; image: string; name: string }
/** A pocket key "page-row-col", or "tray". Drop targets carry it in `data-drop`. */
export type DropKey = string

const LONG_PRESS = 400 // ms before a touch starts a drag (AC-16)
const EDGE = 48 // px from the pages' left or right edge
const EDGE_HOLD = 600 // ms at the edge before the page turns
const SLOP = 6 // px a mouse moves before a press becomes a drag

/**
 * Drag and drop with pointer events (spec 007, AC-15, AC-16): a ghost follows the
 * pointer, the target is the `[data-drop]` element under it. Holding at the edge
 * of `edgeEl` turns the page.
 */
export function useBinderDrag(opts: {
  onDrop: (source: DragSource, target: DropKey) => void
  onEdge: (direction: -1 | 1) => void
  edgeEl: () => HTMLElement | null
}) {
  const source = shallowRef<DragSource | null>(null)
  const pointer = ref({ x: 0, y: 0 })
  const over = ref<DropKey | null>(null)
  let pending: { source: DragSource; x: number; y: number; touch: boolean; timer?: ReturnType<typeof setTimeout> } | null = null
  let edgeTimer: ReturnType<typeof setTimeout> | null = null
  let edgeSide: -1 | 0 | 1 = 0

  function start(drag: DragSource, event: PointerEvent) {
    if (event.button !== 0 || source.value) return
    const touch = event.pointerType === 'touch'
    pending = { source: drag, x: event.clientX, y: event.clientY, touch }
    if (touch) pending.timer = setTimeout(() => begin(event.clientX, event.clientY), LONG_PRESS)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  function begin(x: number, y: number) {
    if (!pending) return
    source.value = pending.source
    pending = null
    pointer.value = { x, y }
    document.body.style.userSelect = 'none'
    document.body.dataset.dragging = '' // hover previews stay shut (spec 009, AC-9)
    window.addEventListener('touchmove', blockScroll, { passive: false })
  }

  function blockScroll(e: TouchEvent) {
    e.preventDefault()
  }

  function move(e: PointerEvent) {
    if (pending) {
      const far = Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > SLOP
      if (pending.touch) {
        if (far) cancel() // a swipe scrolls instead
        return
      }
      if (!far) return
      begin(e.clientX, e.clientY)
    }
    if (!source.value) return
    e.preventDefault()
    pointer.value = { x: e.clientX, y: e.clientY }
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-drop]')
    over.value = target?.dataset.drop ?? null
    edge(e.clientX)
  }

  function edge(x: number) {
    const rect = opts.edgeEl()?.getBoundingClientRect()
    const side: -1 | 0 | 1 = !rect ? 0 : x < rect.left + EDGE ? -1 : x > rect.right - EDGE ? 1 : 0
    if (side === edgeSide) return
    edgeSide = side
    if (edgeTimer) clearTimeout(edgeTimer)
    edgeTimer = null
    if (side) {
      const turn = () => {
        opts.onEdge(side)
        edgeTimer = setTimeout(turn, EDGE_HOLD)
      }
      edgeTimer = setTimeout(turn, EDGE_HOLD)
    }
  }

  function up() {
    const dragged = source.value
    const target = over.value
    stop()
    if (!dragged) return
    // The click after a drag must not open the card.
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    if (target) opts.onDrop(dragged, target)
  }

  function swallow(e: Event) {
    e.stopPropagation()
    e.preventDefault()
  }

  function cancel() {
    stop()
  }

  function stop() {
    if (pending?.timer) clearTimeout(pending.timer)
    pending = null
    source.value = null
    over.value = null
    edgeSide = 0
    if (edgeTimer) clearTimeout(edgeTimer)
    edgeTimer = null
    document.body.style.userSelect = ''
    delete document.body.dataset.dragging
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('touchmove', blockScroll)
  }

  onBeforeUnmount(stop)
  return { source, pointer, over, start }
}
