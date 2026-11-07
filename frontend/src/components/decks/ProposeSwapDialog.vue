<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardSearch from '@/components/collection/CardSearch.vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DeckCard, DeckDetail } from '@/lib/decks'

/** Pick a card to swap in: it joins the Maybeboard linked to `card` (spec 005, AC-9). */
const props = defineProps<{ deck: DeckDetail; card: DeckCard | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const query = ref('')
const busy = ref(false)
watch(open, (isOpen) => isOpen && (query.value = ''))

async function choose(result: Schemas['CardSearchResult']) {
  if (!props.card || busy.value) return
  busy.value = true
  // The newest printing, like adding a card (spec 004, AC-9).
  const { data: printings } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  const printing = printings?.[0]
  if (!printing) return (busy.value = false)
  const { data, error } = await api.POST('/api/decks/{id}/cards/{card_id}/swaps/', {
    params: { path: { id: props.deck.id, card_id: props.card.id } }, body: { printing: printing.id },
  })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not propose the swap.')
  toast.success(`${result.name} could replace ${props.card.printing.name}.`)
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl" data-testid="swap-dialog">
      <DialogHeader>
        <DialogTitle>Swap for {{ card?.printing.name }}</DialogTitle>
        <DialogDescription class="sr-only">Pick a card to propose</DialogDescription>
      </DialogHeader>
      <CardSearch v-model:query="query" @choose="choose" />
    </DialogContent>
  </Dialog>
</template>
