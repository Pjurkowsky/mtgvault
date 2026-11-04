<script setup lang="ts">
import CardMenu from '@/components/browser/CardMenu.vue'
import type { DeckCard } from '@/lib/decks'

/** Right-click menu on a deck card in every view: Edit, Propose swap, Delete (spec 005, AC-7). */
const props = defineProps<{ card: DeckCard; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
</script>

<template>
  <CardMenu
    v-if="editable" :editable="true" :items="card.zone === 'maybe' ? ['edit', 'delete'] : ['edit', 'swap', 'delete']"
    @edit="emit('open', props.card)" @swap="emit('swap', props.card)" @delete="emit('delete', props.card)"
  >
    <slot />
  </CardMenu>
  <slot v-else />
</template>
