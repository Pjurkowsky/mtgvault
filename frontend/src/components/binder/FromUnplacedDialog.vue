<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SearchIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Binder, Place } from '@/lib/binder'
import { sectionOf, slotNumber } from '@/lib/binder'

/** Pick a tray card for an empty pocket; the pocket's section matches come first (spec 007, AC-14). */
const props = defineProps<{ binder: Binder; place: Place | null; unplaced: { row: BrowserRow; count: number }[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [row: BrowserRow] }>()

const q = ref('')
watch(open, (isOpen) => isOpen && (q.value = ''))
const section = computed(() => (props.place ? sectionOf(props.place.page, props.binder.sections) : null))
const shown = computed(() => {
  const matching = new Set(section.value?.matching ?? [])
  const needle = q.value.trim().toLowerCase()
  return props.unplaced
    .filter((u) => !needle || u.row.printing.name.toLowerCase().includes(needle))
    .map((u) => ({ ...u, match: matching.has(u.row.id) }))
    .sort((a, b) => Number(b.match) - Number(a.match) || a.row.printing.name.localeCompare(b.row.printing.name))
})
function pick(row: BrowserRow) {
  emit('pick', row)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="from-unplaced">
      <DialogHeader>
        <DialogTitle>Page {{ place?.page }}, slot {{ place ? slotNumber(place, binder.cols) : '' }}</DialogTitle>
      </DialogHeader>
      <div class="relative">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" type="search" aria-label="Search unplaced" placeholder="Search" class="pl-8" />
      </div>
      <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <li v-for="u in shown" :key="u.row.id" class="relative">
          <button
            type="button" class="block w-full overflow-hidden rounded-[4.75%/3.5%] hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :aria-label="u.row.printing.name" :data-match="u.match" data-testid="unplaced-choice" @click="pick(u.row)"
          >
            <img :src="u.row.printing.image_small" :alt="u.row.printing.name" class="aspect-[488/680] w-full bg-muted object-cover" />
          </button>
          <span v-if="u.count > 1" class="pointer-events-none absolute top-1 right-1 rounded-md bg-background/90 px-1 text-xs font-semibold shadow">×{{ u.count }}</span>
          <span v-if="u.match" class="pointer-events-none absolute bottom-1 left-1 rounded-md bg-background/90 px-1 text-xs shadow">{{ section?.name }}</span>
        </li>
      </ul>
      <p v-if="!shown.length" class="py-6 text-center text-sm text-muted-foreground">No cards match.</p>
    </DialogContent>
  </Dialog>
</template>
