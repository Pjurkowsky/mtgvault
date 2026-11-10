<script setup lang="ts">
import { computed } from 'vue'
import Price from '@/components/Price.vue'
import { groupDeck, type DeckCard, type GroupBy, type SortBy } from '@/lib/decks'
import DeckCardMenu from './DeckCardMenu.vue'
import GroupHeading from './GroupHeading.vue'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/**
 * Moxfield-style list: grouped columns. The hovered or keyboard-focused card shows large in the
 * deck page's side column (spec 004 AC-18, spec 011 AC-1, spec 021 AC-7).
 */
const props = defineProps<{ cards: DeckCard[]; currency: string; groupBy: GroupBy; sortBy: SortBy; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; categories: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard]; point: [card: DeckCard] }>()

const groups = computed(() => groupDeck(props.cards, props.groupBy, props.sortBy))
</script>

<template>
  <div class="columns-1 gap-6 lg:columns-2 2xl:columns-3" data-testid="deck-list">
    <section v-for="g in groups" :key="g.key" class="mb-5 break-inside-avoid" :data-testid="`group-${g.key}`">
      <GroupHeading :group="g" :currency="currency" class="mb-1 border-b pb-1" />
      <ul>
        <li v-for="card in g.cards" :key="card.id">
          <DeckCardMenu :card="card" :editable="editable" @open="emit('open', $event)" @categories="emit('categories', $event)" @swap="emit('swap', $event)" @delete="emit('delete', $event)">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            :aria-label="card.printing.name" data-testid="deck-row" data-deck-card
            @pointerenter="emit('point', card)" @focus="emit('point', card)" @click="emit('open', card)"
          >
            <span class="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{{ card.quantity }}</span>
            <span class="min-w-0 flex-1 truncate">{{ card.printing.name }}</span>
            <ManaCost :cost="card.printing.mana_cost" class="shrink-0" />
            <OwnershipBadge :card="card" />
            <span class="w-14 shrink-0 text-right text-xs text-muted-foreground"><Price :value="card.price" :values="card.prices" :currency="currency" /></span>
          </button>
          </DeckCardMenu>
        </li>
      </ul>
    </section>
  </div>
</template>
