<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DeckDetail } from '@/lib/decks'

/** Give a deck its box; move free owned copies into it (spec 004, AC-5). */
const props = defineProps<{ deck: DeckDetail }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

type Move = { item_id: number; quantity: number; name: string; location: string }
const moves = computed<Move[]>(() => {
  const seen = new Set<number>()
  const out: Move[] = []
  for (const card of props.deck.cards) {
    if (card.zone === 'maybe') continue
    let need = card.ownership.needed
    for (const copy of card.ownership.free_copies) {
      if (need <= 0 || seen.has(copy.item_id)) continue
      seen.add(copy.item_id)
      const quantity = Math.min(need, copy.quantity)
      need -= quantity
      out.push({ item_id: copy.item_id, quantity, name: card.printing.name, location: copy.location })
    }
  }
  return out
})
const ticked = ref(new Set<number>())
watch(open, (isOpen) => isOpen && (ticked.value = new Set(moves.value.map((m) => m.item_id))))
const busy = ref(false)

function toggle(id: number, on: boolean) {
  const next = new Set(ticked.value)
  if (on) next.add(id)
  else next.delete(id)
  ticked.value = next
}

async function create() {
  busy.value = true
  const { data } = await api.POST('/api/decks/{id}/box/', {
    params: { path: { id: props.deck.id } },
    body: { moves: moves.value.filter((m) => ticked.value.has(m.item_id)).map(({ item_id, quantity }) => ({ item_id, quantity })) },
  })
  busy.value = false
  if (!data) return toast.error('Could not create the deck box.')
  toast.success(`Created deck box ${data.location_name}.`)
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="create-box-dialog">
      <DialogHeader>
        <DialogTitle>Create deck box</DialogTitle>
        <DialogDescription v-if="moves.length">Move these owned copies into it:</DialogDescription>
      </DialogHeader>
      <ul v-if="moves.length" class="grid max-h-80 gap-1.5 overflow-y-auto">
        <li v-for="m in moves" :key="m.item_id">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="ticked.has(m.item_id)" @update:model-value="(on) => toggle(m.item_id, on === true)" />
            <span class="flex-1">{{ m.quantity }} {{ m.name }}</span>
            <span class="text-muted-foreground">{{ m.location }}</span>
          </label>
        </li>
      </ul>
      <DialogFooter>
        <Button :disabled="busy" @click="create">Create{{ ticked.size ? ` and move ${ticked.size}` : '' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
