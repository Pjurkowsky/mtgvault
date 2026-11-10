<script setup lang="ts">
import { computed } from 'vue'
import CardPreview from '@/components/CardPreview.vue'
import { groupDeck, type DeckCard, type GroupBy, type SortBy } from '@/lib/decks'
import DeckCardMenu from './DeckCardMenu.vue'
import GroupHeading from './GroupHeading.vue'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/** Compact rows; the card image appears beside the hovered line, like EDHREC (spec 005, AC-6). */
const props = defineProps<{ cards: DeckCard[]; groupBy: GroupBy; sortBy: SortBy; editable: boolean; currency: string }>()
const emit = defineEmits<{ open: [card: DeckCard]; categories: [card: DeckCard]; swap: [card: DeckCard]; delete: [card: DeckCard] }>()
const groups = computed(() => groupDeck(props.cards, props.groupBy, props.sortBy))
</script>

<template>
  <div class="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5" data-testid="deck-text">
    <section v-for="g in groups" :key="g.key" class="mb-4 break-inside-avoid" :data-testid="`group-${g.key}`">
      <GroupHeading :group="g" :currency="currency" class="mb-1" />
      <ul>
        <li v-for="card in g.cards" :key="card.id">
          <DeckCardMenu :card="card" :editable="editable" @open="emit('open', $event)" @categories="emit('categories', $event)" @swap="emit('swap', $event)" @delete="emit('delete', $event)">
            <CardPreview :image="card.printing.image_normal" :name="card.printing.name">
              <button
                type="button" class="flex w-full items-center gap-1.5 rounded px-1 text-left text-sm leading-6 hover:bg-muted"
                :aria-label="card.printing.name" data-testid="deck-row" data-deck-card @click="emit('open', card)"
              >
                <span class="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{{ card.quantity }}</span>
                <span class="min-w-0 flex-1 truncate">{{ card.printing.name }}</span>
                <ManaCost :cost="card.printing.mana_cost" class="shrink-0" />
                <OwnershipBadge :card="card" />
              </button>
            </CardPreview>
          </DeckCardMenu>
        </li>
      </ul>
    </section>
  </div>
</template>
