<script setup lang="ts">
import { computed } from 'vue'
import CardMenu, { type MenuItem } from '@/components/browser/CardMenu.vue'
import type { DeckCard } from '@/lib/decks'

/** Right-click menu on a deck card in every view: Edit, Propose swap, Delete (spec 005, AC-7). */
const props = defineProps<{ card: DeckCard; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; categories: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
// Let the menu close and hand back focus before a dialog opens, or Escape stops reaching the dialog.
function later(action: 'open' | 'categories' | 'swap' | 'delete') {
  setTimeout(() => emit(action as 'open', props.card))
}
const items = computed<MenuItem[]>(() => [
  'edit',
  'categories',
  ...(props.card.zone === 'maybe' ? [] : ['swap' as const]),
  ...(props.card.ownership.state === 'missing' ? ['want' as const] : []),
  'delete',
])
</script>

<template>
  <CardMenu
    v-if="editable" :editable="true" :items="items"
    @edit="later('open')" @categories="later('categories')" @swap="later('swap')" @delete="later('delete')"
  >
    <slot />
  </CardMenu>
  <slot v-else />
</template>
