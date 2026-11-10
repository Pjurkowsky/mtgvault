<script setup lang="ts">
import type { DeckCard } from '@/lib/decks'
import DeckCardMenu from './DeckCardMenu.vue'

/** The commander(s) as large images beside the cards, partners stacked (spec 021, AC-5). */
defineProps<{ cards: DeckCard[]; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; categories: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
</script>

<template>
  <ul class="flex gap-3 lg:grid" data-testid="deck-commander">
    <li v-for="card in cards" :key="card.id" class="w-40 lg:w-full">
      <DeckCardMenu :card="card" :editable="editable" @open="emit('open', $event)" @categories="emit('categories', $event)" @swap="emit('swap', $event)" @delete="emit('delete', $event)">
        <button type="button" class="block w-full rounded-[4.75%/3.5%] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" :aria-label="card.printing.name" data-deck-card @click="emit('open', card)">
          <img :src="card.printing.image_normal" :alt="card.printing.name" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted shadow" />
        </button>
      </DeckCardMenu>
    </li>
  </ul>
</template>
