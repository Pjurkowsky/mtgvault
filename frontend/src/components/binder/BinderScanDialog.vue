<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { placeOf, slotNumber, type Direction, type Place } from '@/lib/binder'

/** Where scans into a binder go: in order from a page and slot, along rows or down columns, or Unplaced (spec 007, AC-21). */
export type BinderScan = { inOrder: boolean; cursor: Place; direction: Direction }
const props = defineProps<{ current: BinderScan; rows: number; cols: number }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [value: BinderScan] }>()

const mode = ref<'order' | 'unplaced'>('order')
const page = ref(1)
const slot = ref(1)
const direction = ref<Direction>('rows')
watch(open, (isOpen) => {
  if (!isOpen) return
  mode.value = props.current.inOrder ? 'order' : 'unplaced'
  page.value = props.current.cursor.page
  slot.value = slotNumber(props.current.cursor, props.cols)
  direction.value = props.current.direction
})

function save() {
  const max = props.rows * props.cols
  const n = Math.min(Math.max(1, slot.value || 1), max)
  emit('confirm', { inOrder: mode.value === 'order', cursor: placeOf(Math.max(1, page.value || 1), n, props.cols), direction: direction.value })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="text-foreground sm:max-w-sm" data-testid="binder-scan">
      <DialogHeader><DialogTitle>Scans into the binder</DialogTitle></DialogHeader>
      <RadioGroup v-model="mode" class="grid gap-2">
        <label class="flex items-center gap-2 text-sm"><RadioGroupItem value="order" aria-label="In order" /> In order</label>
        <label class="flex items-center gap-2 text-sm"><RadioGroupItem value="unplaced" aria-label="Unplaced" /> Unplaced</label>
      </RadioGroup>
      <template v-if="mode === 'order'">
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-1.5"><Label for="scan-page">From page</Label><Input id="scan-page" v-model.number="page" type="number" min="1" max="500" /></div>
          <div class="grid gap-1.5"><Label for="scan-slot">Slot</Label><Input id="scan-slot" v-model.number="slot" type="number" min="1" :max="rows * cols" /></div>
        </div>
        <RadioGroup v-model="direction" class="grid gap-2">
          <label class="flex items-center gap-2 text-sm"><RadioGroupItem value="rows" aria-label="Along rows" /> Along rows</label>
          <label class="flex items-center gap-2 text-sm"><RadioGroupItem value="columns" aria-label="Down columns" /> Down columns</label>
        </RadioGroup>
      </template>
      <DialogFooter><Button @click="save">Use</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
