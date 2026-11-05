<script setup lang="ts">
import { computed } from 'vue'
import CardMenu, { type MenuItem } from '@/components/browser/CardMenu.vue'
import type { DeckCard } from '@/lib/decks'

/** Right-click menu on a deck card in every view: Edit, Propose swap, Delete (spec 005, AC-7). */
const props = defineProps<{ card: DeckCard; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
const items = computed<MenuItem[]>(() => [
  'edit',
  ...(props.card.zone === 'maybe' ? [] : ['swap' as const]),
  ...(props.card.ownership.state === 'missing' ? ['want' as const] : []),
  'delete',
])
</script>

<template>
  <CardMenu
    v-if="editable" :editable="true" :items="items"
    @edit="emit('open', props.card)" @swap="emit('swap', props.card)" @delete="emit('delete', props.card)"
  >
    <slot />
  </CardMenu>
  <slot v-else />
</template>
