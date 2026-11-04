<script setup lang="ts">
import { computed } from 'vue'
import { groupDeck, type DeckCard, type GroupBy, type SortBy } from '@/lib/decks'
import DeckCardMenu from './DeckCardMenu.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/** Card images grouped like the list (spec 004, AC-19). */
const props = defineProps<{ cards: DeckCard[]; groupBy: GroupBy; sortBy: SortBy; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
const groups = computed(() => groupDeck(props.cards, props.groupBy, props.sortBy))
</script>

<template>
  <div class="grid gap-6" data-testid="deck-visual">
    <section v-for="g in groups" :key="g.key">
      <h3 class="mb-2 text-sm font-semibold">{{ g.label }} <span class="font-normal text-muted-foreground">({{ g.count }})</span></h3>
      <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        <li v-for="card in g.cards" :key="card.id" class="relative">
          <DeckCardMenu :card="card" :editable="editable" @open="emit('open', $event)" @swap="emit('swap', $event)" @delete="emit('delete', $event)">
            <button type="button" class="block w-full" :aria-label="card.printing.name" @click="emit('open', card)">
              <img :src="card.printing.image_normal" :alt="card.printing.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
            </button>
          </DeckCardMenu>
          <span class="absolute top-1.5 left-1.5 rounded bg-background/90 px-1 text-xs font-semibold shadow">×{{ card.quantity }}</span>
          <span class="absolute right-1.5 bottom-1.5 rounded bg-background/90 px-1 shadow"><OwnershipBadge :card="card" /></span>
        </li>
      </ul>
    </section>
  </div>
</template>
