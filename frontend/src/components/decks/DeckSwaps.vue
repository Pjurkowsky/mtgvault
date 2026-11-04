<script setup lang="ts">
import { computed } from 'vue'
import CardPreview from '@/components/CardPreview.vue'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/** Cards with swap candidates, each candidate compared to the card it replaces (spec 005, AC-10, AC-13). */
const props = defineProps<{ deck: DeckDetail; readonly?: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; apply: [candidate: DeckCard]; remove: [candidate: DeckCard] }>()

const pairs = computed(() =>
  props.deck.cards
    .map((card) => ({ card, candidates: props.deck.cards.filter((c) => c.swap_for === card.id) }))
    .filter((p) => p.candidates.length)
    .sort((a, b) => a.card.printing.name.localeCompare(b.card.printing.name)),
)

/** `text` is the absolute difference; the sign comes from `value`. */
function signed(value: number, text: string) {
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}
function priceDiff(out: DeckCard, into: DeckCard) {
  if (out.price === null || into.price === null) return '–'
  const diff = into.price - out.price
  return signed(diff, formatMoney(Math.abs(diff), props.deck.currency))
}
function mvDiff(out: DeckCard, into: DeckCard) {
  const diff = Number(into.printing.cmc) - Number(out.printing.cmc)
  return signed(diff, String(Math.abs(diff)))
}
</script>

<template>
  <div v-if="pairs.length" class="grid gap-5" data-testid="deck-swaps">
    <section v-for="{ card, candidates } in pairs" :key="card.id" class="grid gap-1" :data-testid="`swap-${card.printing.name}`">
      <CardPreview :image="card.printing.image_normal" :name="card.printing.name">
        <button type="button" class="flex items-center gap-2 text-left font-medium" @click="emit('open', card)">
          {{ card.printing.name }} <ManaCost :cost="card.printing.mana_cost" />
        </button>
      </CardPreview>
      <ul class="grid gap-1 border-l pl-3">
        <li v-for="c in candidates" :key="c.id" class="flex flex-wrap items-center gap-3 text-sm" data-testid="swap-candidate">
          <CardPreview :image="c.printing.image_normal" :name="c.printing.name">
            <button type="button" class="flex min-w-40 flex-1 items-center gap-2 text-left" @click="emit('open', c)">
              {{ c.printing.name }} <ManaCost :cost="c.printing.mana_cost" />
            </button>
          </CardPreview>
          <span class="w-20 text-muted-foreground tabular-nums" data-testid="swap-price">{{ priceDiff(card, c) }}</span>
          <span class="w-12 text-muted-foreground tabular-nums" data-testid="swap-mv">{{ mvDiff(card, c) }}</span>
          <OwnershipBadge :card="c" show-label />
          <span v-if="!readonly" class="ml-auto flex gap-2">
            <Button size="sm" variant="outline" @click="emit('apply', c)">Apply</Button>
            <Button size="sm" variant="ghost" class="text-destructive" @click="emit('remove', c)">Remove</Button>
          </span>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="py-16 text-center text-muted-foreground">No swaps proposed.</p>
</template>
