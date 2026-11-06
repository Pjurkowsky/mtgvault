<script setup lang="ts">
import { computed, ref } from 'vue'
import { InboxIcon, SearchIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import CardPreview from '@/components/CardPreview.vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { DragSource } from '@/composables/useBinderDrag'

/** The binder's copies without a slot (spec 007, AC-12): small tiles, its own search, a drop target. */
/** `q`: the browser's search; while set, only matching cards show (spec 009, AC-5). */
const props = defineProps<{ unplaced: { row: BrowserRow; count: number }[]; editable: boolean; over: boolean; q?: string }>()
const emit = defineEmits<{ open: [row: BrowserRow]; drag: [source: DragSource, event: PointerEvent] }>()

const q = ref('')
const shown = computed(() => {
  const needle = (props.q?.trim() || q.value.trim()).toLowerCase()
  return needle ? props.unplaced.filter((u) => u.row.printing.name.toLowerCase().includes(needle)) : props.unplaced
})
const total = computed(() => props.unplaced.reduce((n, u) => n + u.count, 0))

function press(row: BrowserRow, event: PointerEvent) {
  if (props.editable) emit('drag', { item: row.id, image: row.printing.image_normal, name: row.printing.name }, event)
}
</script>

<template>
  <div
    class="relative flex flex-col bg-card transition-colors" :class="over && 'bg-primary/5'"
    :data-drop="editable ? 'tray' : undefined" data-testid="unplaced-tray"
  >
    <header class="sticky top-0 z-10 grid gap-3 border-b bg-card/95 px-4 pt-4 pb-3 backdrop-blur">
      <div class="flex items-center gap-2.5">
        <span class="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"><InboxIcon class="size-4" /></span>
        <h3 class="font-semibold">Unplaced</h3>
        <Badge variant="secondary" class="ml-auto tabular-nums" data-testid="unplaced-count">{{ total }}</Badge>
      </div>
      <div v-if="unplaced.length > 6 && !props.q?.trim()" class="relative">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" type="search" aria-label="Search unplaced" placeholder="Search" class="h-8 pl-8" />
      </div>
    </header>

    <ul v-if="shown.length" class="grid grid-cols-3 gap-2.5 p-4">
      <li v-for="u in shown" :key="u.row.id" class="relative">
        <CardPreview :image="u.row.printing.image_normal" :name="u.row.printing.name">
          <button
            type="button"
            class="block w-full touch-manipulation overflow-hidden rounded-[4.75%/3.5%] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :aria-label="u.row.printing.name" data-testid="unplaced-card" @click="emit('open', u.row)" @pointerdown="press(u.row, $event)"
          >
            <img :src="u.row.printing.image_small" :alt="u.row.printing.name" loading="lazy" draggable="false" class="aspect-[488/680] w-full bg-muted object-cover" />
          </button>
        </CardPreview>
        <span
          v-if="u.count > 1"
          class="pointer-events-none absolute -right-1 -bottom-1 rounded-full border bg-background px-1.5 text-xs font-semibold tabular-nums shadow-sm"
          data-testid="unplaced-quantity"
        >×{{ u.count }}</span>
      </li>
    </ul>
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
      <InboxIcon class="size-8 opacity-40" />
      {{ unplaced.length ? 'No cards match.' : 'Every card has a slot.' }}
    </div>

    <div
      v-if="over" class="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 text-sm font-medium text-primary"
    >Drop to unplace</div>
  </div>
</template>
