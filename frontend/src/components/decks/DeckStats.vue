<script setup lang="ts">
import { computed } from 'vue'
import ManaSymbol from '@/components/ManaSymbol.vue'
import Price from '@/components/Price.vue'
import { Card } from '@/components/ui/card'
import type { DeckDetail } from '@/lib/decks'

/** Mana curve, colors, types, average mana value and value (spec 004, AC-24). */
const props = defineProps<{ deck: DeckDetail }>()
const curve = computed(() => Object.entries(props.deck.stats.curve))
const peak = computed(() => Math.max(1, ...curve.value.map(([, n]) => n)))
const pips = computed(() => Object.entries(props.deck.stats.pips).filter(([, n]) => n > 0) as [('W' | 'U' | 'B' | 'R' | 'G' | 'C'), number][])
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2" data-testid="deck-stats">
    <Card class="gap-3 p-4">
      <h3 class="text-sm font-semibold">Mana curve</h3>
      <div class="flex h-40 items-end gap-2" data-testid="mana-curve">
        <div v-for="[mv, n] in curve" :key="mv" class="flex h-full flex-1 flex-col items-center gap-1" :data-mv="mv">
          <div class="flex w-full flex-1 flex-col justify-end">
            <span class="text-center text-xs text-muted-foreground">{{ n }}</span>
            <div class="w-full rounded-t bg-primary/80" :style="{ height: `${(n / peak) * 85}%` }" />
          </div>
          <span class="text-xs">{{ mv }}</span>
        </div>
      </div>
      <p class="text-sm text-muted-foreground" data-testid="average-mv">Average mana value {{ deck.stats.average_mana_value.toFixed(2) }}</p>
    </Card>
    <Card class="gap-3 p-4">
      <h3 class="text-sm font-semibold">Colors</h3>
      <ul class="flex flex-wrap gap-4" data-testid="pips">
        <li v-for="[symbol, n] in pips" :key="symbol" class="flex items-center gap-1.5"><ManaSymbol :symbol="symbol" /> {{ n }}</li>
      </ul>
      <h3 class="text-sm font-semibold">Types</h3>
      <ul class="grid grid-cols-2 gap-1 text-sm" data-testid="types">
        <li v-for="(n, type) in deck.stats.types" :key="type" class="flex justify-between"><span>{{ type }}</span><span class="text-muted-foreground">{{ n }}</span></li>
      </ul>
    </Card>
    <Card class="gap-2 p-4 md:col-span-2">
      <h3 class="text-sm font-semibold">Value</h3>
      <dl class="grid grid-cols-3 gap-2 text-sm" data-testid="deck-value">
        <div><dt class="text-muted-foreground">Total</dt><dd><Price :value="deck.stats.value.total" :values="deck.stats.values.total" :currency="deck.currency" /></dd></div>
        <div><dt class="text-muted-foreground">Owned</dt><dd><Price :value="deck.stats.value.owned" :values="deck.stats.values.owned" :currency="deck.currency" /></dd></div>
        <div><dt class="text-muted-foreground">To buy</dt><dd><Price :value="deck.stats.value.missing" :values="deck.stats.values.missing" :currency="deck.currency" /></dd></div>
      </dl>
    </Card>
  </div>
</template>
