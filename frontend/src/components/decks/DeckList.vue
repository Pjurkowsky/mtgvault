<script setup lang="ts">
import { computed, ref } from 'vue'
import Price from '@/components/Price.vue'
import { groupDeck, type DeckCard, type GroupBy, type SortBy } from '@/lib/decks'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/** Moxfield-style list: grouped columns, big image of the hovered card (spec 004, AC-18). */
const props = defineProps<{ cards: DeckCard[]; currency: string; groupBy: GroupBy; sortBy: SortBy }>()
const emit = defineEmits<{ open: [card: DeckCard] }>()

const groups = computed(() => groupDeck(props.cards, props.groupBy, props.sortBy))
const hovered = ref<DeckCard | null>(null)
const shown = computed(() => hovered.value ?? groups.value[0]?.cards[0] ?? null)
</script>

<template>
  <div class="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
    <div class="hidden md:block">
      <img
        v-if="shown" :src="shown.printing.image_normal" :alt="shown.printing.name"
        class="sticky top-4 w-full rounded-[4.75%/3.5%] bg-muted shadow" data-testid="deck-preview"
      />
    </div>
    <div class="columns-1 gap-6 lg:columns-2" data-testid="deck-list">
      <section v-for="g in groups" :key="g.key" class="mb-5 break-inside-avoid" :data-testid="`group-${g.key}`">
        <h3 class="mb-1 border-b pb-1 text-sm font-semibold">{{ g.label }} <span class="font-normal text-muted-foreground">({{ g.count }})</span></h3>
        <ul>
          <li v-for="card in g.cards" :key="card.id">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-muted"
              :aria-label="card.printing.name" data-testid="deck-row"
              @mouseenter="hovered = card" @focus="hovered = card" @click="emit('open', card)"
            >
              <span class="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{{ card.quantity }}</span>
              <span class="min-w-0 flex-1 truncate">{{ card.printing.name }}</span>
              <ManaCost :cost="card.printing.mana_cost" class="shrink-0" />
              <OwnershipBadge :card="card" />
              <span class="w-14 shrink-0 text-right text-xs text-muted-foreground"><Price :value="card.price" :values="card.prices" :currency="currency" /></span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
