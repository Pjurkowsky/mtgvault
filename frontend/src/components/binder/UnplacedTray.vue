<script setup lang="ts">
import { computed, ref } from 'vue'
import { SearchIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import CardPreview from '@/components/CardPreview.vue'
import { Input } from '@/components/ui/input'
import type { DragSource } from '@/composables/useBinderDrag'

/** The binder's copies without a slot (spec 007, AC-12): small tiles, its own search, a drop target. */
const props = defineProps<{ unplaced: { row: BrowserRow; count: number }[]; editable: boolean; over: boolean }>()
const emit = defineEmits<{ open: [row: BrowserRow]; drag: [source: DragSource, event: PointerEvent] }>()

const q = ref('')
const shown = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return needle ? props.unplaced.filter((u) => u.row.printing.name.toLowerCase().includes(needle)) : props.unplaced
})
const total = computed(() => props.unplaced.reduce((n, u) => n + u.count, 0))

function press(row: BrowserRow, event: PointerEvent) {
  if (props.editable) emit('drag', { item: row.id, image: row.printing.image_normal, name: row.printing.name }, event)
}
</script>

<template>
  <div
    class="grid content-start gap-3 rounded-lg border bg-card p-3 transition-shadow" :class="over && 'ring-2 ring-primary'"
    :data-drop="editable ? 'tray' : undefined" data-testid="unplaced-tray"
  >
    <h3 class="flex items-baseline justify-between text-sm font-semibold">
      Unplaced <span class="font-normal text-muted-foreground" data-testid="unplaced-count">{{ total }}</span>
    </h3>
    <div v-if="unplaced.length > 6" class="relative">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="q" type="search" aria-label="Search unplaced" placeholder="Search" class="h-8 pl-8" />
    </div>
    <ul v-if="shown.length" class="grid grid-cols-3 gap-2 lg:grid-cols-2 xl:grid-cols-3">
      <li v-for="u in shown" :key="u.row.id" class="relative">
        <CardPreview :image="u.row.printing.image_normal" :name="u.row.printing.name">
          <button
            type="button" class="block w-full touch-manipulation overflow-hidden rounded-[4.75%/3.5%] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :aria-label="u.row.printing.name" data-testid="unplaced-card" @click="emit('open', u.row)" @pointerdown="press(u.row, $event)"
          >
            <img :src="u.row.printing.image_small" :alt="u.row.printing.name" loading="lazy" draggable="false" class="aspect-[488/680] w-full bg-muted object-cover" />
          </button>
        </CardPreview>
        <span v-if="u.count > 1" class="pointer-events-none absolute top-1 right-1 rounded-md bg-background/90 px-1 text-xs font-semibold shadow" data-testid="unplaced-quantity">×{{ u.count }}</span>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-muted-foreground">{{ unplaced.length ? 'No cards match.' : 'Every card has a slot.' }}</p>
  </div>
</template>
