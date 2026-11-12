<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { Schemas } from '@/api/client'

/**
 * Combat arrows over the board (spec 026, AC-6): attacker → the player or planeswalker it attacks,
 * blocker → the creature it blocks. Drawn from where the cards are, again after each step and resize.
 */
const props = defineProps<{ board: Schemas['BoardSeat'][] | null; container: HTMLElement | null }>()
type Arrow = { kind: 'attack' | 'block'; from: number; to: string; x1: number; y1: number; x2: number; y2: number }
const arrows = ref<Arrow[]>([])

function centre(el: Element, box: DOMRect) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
}
function draw() {
  const root = props.container
  if (!root || !props.board) return (arrows.value = [])
  const box = root.getBoundingClientRect()
  const find = (selector: string) => root.querySelector(selector)
  const out: Arrow[] = []
  const add = (kind: Arrow['kind'], from: number, to: string, target: Element | null) => {
    const start = find(`[data-card-id="${from}"]`)
    if (!start || !target) return
    const a = centre(start, box)
    const b = centre(target, box)
    // Stop short of the target's centre so the head shows.
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const cut = Math.min(14, len / 3)
    out.push({ kind, from, to, x1: a.x, y1: a.y, x2: b.x - ((b.x - a.x) / len) * cut, y2: b.y - ((b.y - a.y) / len) * cut })
  }
  for (const seat of props.board) {
    for (const c of seat.battlefield) {
      if (c.attacking?.seat != null) add('attack', c.id, `seat-${c.attacking.seat}`, find(`[data-target-seat="${c.attacking.seat}"] [data-testid="player-life"]`))
      else if (c.attacking?.card != null) add('attack', c.id, `card-${c.attacking.card}`, find(`[data-card-id="${c.attacking.card}"]`))
      for (const id of c.blocking ?? []) add('block', c.id, `card-${id}`, find(`[data-card-id="${id}"]`))
    }
  }
  arrows.value = out
}
watch(() => [props.board, props.container], () => nextTick(draw), { immediate: true })
useResizeObserver(() => props.container, () => draw())
// A card image loading moves the ones after it.
useEventListener(() => props.container, 'load', () => draw(), { capture: true })
</script>

<template>
  <svg class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible" aria-hidden="true" data-testid="combat-arrows">
    <defs>
      <marker id="arrow-attack" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" class="fill-destructive">
        <path d="M0,0 L10,5 L0,10 z" />
      </marker>
      <marker id="arrow-block" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" class="fill-sky-500">
        <path d="M0,0 L10,5 L0,10 z" />
      </marker>
    </defs>
    <line
      v-for="a in arrows" :key="`${a.kind}-${a.from}-${a.to}`" :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2"
      :class="a.kind === 'attack' ? 'stroke-destructive' : 'stroke-sky-500'" stroke-width="3" stroke-linecap="round"
      :marker-end="`url(#arrow-${a.kind})`" :data-kind="a.kind" :data-from="a.from" :data-to="a.to" data-testid="combat-arrow"
    />
  </svg>
</template>
