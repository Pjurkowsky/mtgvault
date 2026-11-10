<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { GlobeIcon, PackageIcon } from '@lucide/vue'
import Price from '@/components/Price.vue'
import { Card } from '@/components/ui/card'
import { formatLabel, type DeckSummary } from '@/lib/decks'

defineProps<{ deck: DeckSummary; currency: string; to: RouteLocationRaw }>()
</script>

<template>
  <Card class="relative gap-0 overflow-hidden p-0 transition-colors hover:bg-muted/50" data-testid="deck-tile">
    <div class="h-48 bg-muted">
      <img v-if="deck.image" :src="deck.image" alt="" class="size-full object-cover object-[50%_30%]" loading="lazy" />
    </div>
    <div class="grid gap-1 p-3">
      <RouterLink :to="to" class="truncate font-medium after:absolute after:inset-0">{{ deck.name }}</RouterLink>
      <p class="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{{ formatLabel(deck.format) }}</span>
        <PackageIcon v-if="deck.location" class="size-3.5" aria-label="Has a deck box" />
        <GlobeIcon v-if="deck.is_public" class="size-3.5" aria-label="Public" />
      </p>
      <p class="text-sm text-muted-foreground" data-testid="deck-tile-counts">
        {{ deck.counts.size }}{{ deck.counts.target ? `/${deck.counts.target}` : '' }} cards · {{ deck.counts.owned }} owned · {{ deck.counts.missing }} missing
      </p>
      <span class="relative z-10 text-sm"><Price :value="deck.value" :values="deck.values" :currency="currency" /></span>
    </div>
  </Card>
</template>
