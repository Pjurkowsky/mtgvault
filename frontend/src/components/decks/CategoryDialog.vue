<script setup lang="ts">
import { toast } from 'vue-sonner'
import { api, fieldErrors } from '@/api/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { refreshSuggestions } from '@/lib/categories'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import CategoryInput from './CategoryInput.vue'

/** Quick category edit from the card menu (spec 006, AC-12). */
const props = defineProps<{ deck: DeckDetail; card: DeckCard | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

async function save(categories: string[]) {
  const { data, error } = await api.PATCH('/api/decks/{id}/cards/{card_id}/', {
    params: { path: { id: props.deck.id, card_id: props.card!.id } }, body: { categories },
  })
  if (!data) return toast.error(Object.values(fieldErrors(error)).join(' ') || 'Could not save the categories.')
  emit('changed', data)
  void refreshSuggestions()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="card" class="sm:max-w-md" data-testid="category-dialog">
      <DialogHeader>
        <DialogTitle>{{ card.printing.name }}</DialogTitle>
        <DialogDescription class="sr-only">Categories for this card</DialogDescription>
      </DialogHeader>
      <CategoryInput :model-value="card.categories" @update:model-value="save" />
    </DialogContent>
  </Dialog>
</template>
