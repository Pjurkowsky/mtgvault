<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDownIcon, ArrowUpIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import IconButton from '@/components/IconButton.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { slotNumber, type BinderSlot, type Place } from '@/lib/binder'

/** The cards sharing a pocket, top first: open one or change the order (spec 007, AC-19). */
const props = defineProps<{ place: Place | null; cols: number; stack: BinderSlot[]; items: Map<number, BrowserRow>; editable: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ open: [row: BrowserRow]; order: [ids: number[]] }>()

const rows = computed(() => props.stack.map((s) => ({ slot: s, row: props.items.get(s.item) })).filter((r) => r.row))
function shift(index: number, by: -1 | 1) {
  const ids = props.stack.map((s) => s.id)
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  emit('order', ids)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md" data-testid="stack-dialog">
      <DialogHeader>
        <DialogTitle>Page {{ place?.page }}, slot {{ place ? slotNumber(place, cols) : '' }}</DialogTitle>
      </DialogHeader>
      <ol class="grid gap-2">
        <li v-for="({ slot, row }, i) in rows" :key="slot.id" class="flex items-center gap-3" data-testid="stack-card">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left hover:bg-muted" :aria-label="row!.printing.name" @click="emit('open', { ...row!, pocket: slot.id })">
            <img :src="row!.printing.image_small" :alt="row!.printing.name" class="w-12 rounded-[4.75%/3.5%]" />
            <span class="truncate text-sm">{{ row!.printing.name }}</span>
          </button>
          <template v-if="editable">
            <IconButton :label="`Move ${row!.printing.name} up`" variant="ghost" :disabled="i === 0" @click="shift(i, -1)"><ArrowUpIcon /></IconButton>
            <IconButton :label="`Move ${row!.printing.name} down`" variant="ghost" :disabled="i === rows.length - 1" @click="shift(i, 1)"><ArrowDownIcon /></IconButton>
          </template>
        </li>
      </ol>
    </DialogContent>
  </Dialog>
</template>
