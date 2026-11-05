<script setup lang="ts">
import type { BrowserRow } from '@/components/browser/types'
import type { DragSource } from '@/composables/useBinderDrag'
import { placeKey, type Binder, type BinderSlot as Slot, type Place } from '@/lib/binder'
import BinderSlot from './BinderSlot.vue'

/** One binder page: its section name and its grid of pockets (spec 007, AC-2, AC-10). */
const props = defineProps<{
  page: number
  binder: Binder
  pockets: Map<string, Slot[]>
  items: Map<number, BrowserRow>
  section: Binder['sections'][number] | null
  editable: boolean
  hasUnplaced: boolean
  over: string | null
  dragging: boolean
}>()
defineEmits<{
  open: [row: BrowserRow]
  stack: [place: Place]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  deck: [row: BrowserRow]
  move: [slot: Slot]
  unplace: [slot: Slot]
  add: [place: Place]
  'from-unplaced': [place: Place]
  scan: [place: Place]
  drag: [source: DragSource, event: PointerEvent]
}>()

const places = () => {
  const out: Place[] = []
  for (let row = 1; row <= props.binder.rows; row++) for (let col = 1; col <= props.binder.cols; col++) out.push({ page: props.page, row, col })
  return out
}
</script>

<template>
  <section class="grid min-w-0 flex-1 content-start gap-2 rounded-lg border bg-card p-3" :data-page="page" data-testid="binder-page">
    <header class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
      <span class="truncate font-medium text-foreground" data-testid="binder-section">{{ section?.name ?? '' }}</span>
      <span>Page {{ page }}</span>
    </header>
    <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${binder.cols}, minmax(0, 1fr))` }">
      <BinderSlot
        v-for="place in places()" :key="placeKey(place)"
        :place="place" :cols="binder.cols" :stack="pockets.get(placeKey(place)) ?? []" :items="items"
        :editable="editable" :has-unplaced="hasUnplaced" :over="over === placeKey(place)" :dragging="dragging"
        @open="$emit('open', $event)" @stack="$emit('stack', $event)" @edit="$emit('edit', $event)" @delete="$emit('delete', $event)"
        @deck="$emit('deck', $event)" @move="$emit('move', $event)" @unplace="$emit('unplace', $event)" @add="$emit('add', $event)"
        @from-unplaced="$emit('from-unplaced', $event)" @scan="$emit('scan', $event)" @drag="(s, e) => $emit('drag', s, e)"
      />
    </div>
  </section>
</template>
