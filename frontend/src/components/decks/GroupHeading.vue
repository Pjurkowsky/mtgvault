<script setup lang="ts">
import { computed } from 'vue'
import Price from '@/components/Price.vue'
import type { Group } from '@/lib/decks'
import type { Money } from '@/lib/money'

/** "Creatures (24) · €58.40" for a group in every deck view (spec 006, AC-3). */
const props = defineProps<{ group: Group; currency: string }>()

const values = computed(() => {
  const out: Record<string, number> = {}
  for (const card of props.group.cards) {
    for (const [cur, price] of Object.entries(card.prices ?? {})) out[cur] = (out[cur] ?? 0) + Number(price ?? 0) * card.quantity
  }
  return out as unknown as Money
})
const value = computed(() => (values.value as unknown as Record<string, number>)[props.currency] ?? null)
</script>

<template>
  <h3 class="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold">
    {{ group.label }} <span class="font-normal text-muted-foreground">({{ group.count }})</span>
    <span class="font-normal text-muted-foreground" data-testid="group-value">· <Price :value="value" :values="values" :currency="currency" /></span>
  </h3>
</template>
