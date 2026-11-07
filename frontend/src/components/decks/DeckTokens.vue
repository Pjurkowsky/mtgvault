<script setup lang="ts">
import { computed } from 'vue'
import type { Schemas } from '@/api/client'
import type { DeckCard } from '@/lib/decks'
import TokenTiles from './TokenTiles.vue'

/**
 * Tokens made by the cards shown (search and filters narrow it), one per kind
 * (spec 015, AC-2 to AC-4). Display only: counts toward nothing.
 */
const props = defineProps<{ tokens: Schemas['DeckToken'][]; cards: DeckCard[] }>()

const shown = computed(() => {
  const names = new Map(props.cards.map((c) => [c.id, c.printing.name]))
  return props.tokens
    .filter((t) => t.makers.some((id) => names.has(id)))
    .map((t) => ({ ...t, caption: `Made by ${t.makers.filter((id) => names.has(id)).map((id) => names.get(id)).join(', ')}` }))
})
</script>

<template>
  <section v-if="shown.length" class="grid gap-2" data-testid="deck-tokens">
    <h3 class="text-sm font-semibold">Tokens <span class="font-normal text-muted-foreground">({{ shown.length }})</span></h3>
    <TokenTiles :tokens="shown" />
  </section>
</template>
