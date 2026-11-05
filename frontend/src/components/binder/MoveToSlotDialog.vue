<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Binder, Place } from '@/lib/binder'

/** Move a card without dragging: page, row and column, or Unplaced (spec 007, AC-18). */
const props = defineProps<{ binder: Binder; name: string; from: Place | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ move: [to: Place | null] }>()

const page = ref(1)
const row = ref(1)
const col = ref(1)
watch(open, (isOpen) => {
  if (!isOpen || !props.from) return
  ;({ page: page.value, row: row.value, col: col.value } = props.from)
})
const maxPage = () => props.binder.pages ?? 500

function submit() {
  emit('move', { page: page.value, row: row.value, col: col.value })
  open.value = false
}
function unplace() {
  emit('move', null)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm" data-testid="move-to-slot">
      <DialogHeader><DialogTitle>Move {{ name }}</DialogTitle></DialogHeader>
      <form class="grid grid-cols-3 gap-3" @submit.prevent="submit">
        <div class="grid gap-1.5"><Label for="move-page">Page</Label><Input id="move-page" v-model.number="page" type="number" min="1" :max="maxPage()" required /></div>
        <div class="grid gap-1.5"><Label for="move-row">Row</Label><Input id="move-row" v-model.number="row" type="number" min="1" :max="binder.rows" required /></div>
        <div class="grid gap-1.5"><Label for="move-col">Column</Label><Input id="move-col" v-model.number="col" type="number" min="1" :max="binder.cols" required /></div>
        <DialogFooter class="col-span-3">
          <Button type="button" variant="outline" @click="unplace">Unplace</Button>
          <Button type="submit">Move</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
