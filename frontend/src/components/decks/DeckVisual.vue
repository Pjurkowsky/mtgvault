<script setup lang="ts">
import { computed } from 'vue'
import CardTile from '@/components/browser/CardTile.vue'
import Price from '@/components/Price.vue'
import { GRID_COLUMNS, type CardSize } from '@/lib/cards'
import { cn } from '@/lib/utils'
import { OWN_STATES, groupDeck, type DeckCard, type GroupBy, type OwnState, type SortBy } from '@/lib/decks'
import DeckCardMenu from './DeckCardMenu.vue'
import GroupHeading from './GroupHeading.vue'

/** Card images grouped like the list, as the collection's grid tiles (spec 004 AC-19, spec 006 AC-1). */
const props = defineProps<{ cards: DeckCard[]; groupBy: GroupBy; sortBy: SortBy; editable: boolean; size: CardSize; currency: string }>()
const emit = defineEmits<{ open: [card: DeckCard]; categories: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
const groups = computed(() => groupDeck(props.cards, props.groupBy, props.sortBy))
const state = (card: DeckCard) => OWN_STATES[card.ownership.state as OwnState]
</script>

<template>
  <div class="grid gap-6" data-testid="deck-visual" :data-size="size">
    <section v-for="g in groups" :key="g.key" :data-testid="`group-${g.key}`">
      <GroupHeading :group="g" :currency="currency" class="mb-2" />
      <ul :class="cn('grid gap-3', GRID_COLUMNS[size])">
        <li v-for="card in g.cards" :key="card.id" class="group">
          <DeckCardMenu :card="card" :editable="editable" @open="emit('open', $event)" @categories="emit('categories', $event)" @swap="emit('swap', $event)" @delete="emit('delete', $event)">
            <CardTile
              :image="size === 'sm' ? card.printing.image_small : card.printing.image_normal" :name="card.printing.name"
              :quantity="card.quantity" :label="card.printing.name" :large="card.printing.image_large || card.printing.image_normal"
              navigable @click="emit('open', card)"
            >
              <template #badges>
                <span class="flex items-center rounded-md bg-background/90 px-1.5 shadow" :data-state="card.ownership.state" data-testid="ownership">
                  <span :class="['size-2 rounded-full', state(card).dot]" /><span class="sr-only">{{ state(card).label }}</span>
                </span>
              </template>
              <template #price><Price :value="card.price" :values="card.prices" :currency="currency" /></template>
            </CardTile>
          </DeckCardMenu>
        </li>
      </ul>
    </section>
  </div>
</template>
