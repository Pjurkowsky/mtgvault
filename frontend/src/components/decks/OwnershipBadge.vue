<script setup lang="ts">
import { HeartIcon } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { OWN_STATES, type DeckCard, type OwnState } from '@/lib/decks'

/** Ownership state of a deck card with details on hover (spec 004, AC-13). */
defineProps<{ card: DeckCard; showLabel?: boolean }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span class="inline-flex items-center gap-1.5 text-xs" tabindex="0" :data-state="card.ownership.state" data-testid="ownership">
        <span :class="['size-2 shrink-0 rounded-full', OWN_STATES[card.ownership.state as OwnState].dot]" />
        <!-- On the want list (spec 010, AC-14) -->
        <HeartIcon v-if="card.ownership.wanted" class="size-3 shrink-0 fill-current text-rose-500" aria-label="On want list" data-testid="wanted" />
        <span v-if="showLabel">{{ OWN_STATES[card.ownership.state as OwnState].label }}</span>
        <span v-else class="sr-only">{{ OWN_STATES[card.ownership.state as OwnState].label }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent class="grid max-w-64 gap-0.5 text-xs">
      <span class="font-medium">{{ OWN_STATES[card.ownership.state as OwnState].label }} · needs {{ card.ownership.needed }}</span>
      <span v-if="card.ownership.in_box">{{ card.ownership.in_box }} in deck box</span>
      <span v-for="f in card.ownership.free_copies" :key="f.item_id">{{ f.quantity }} in {{ f.location }}</span>
      <span v-if="card.ownership.free && !card.ownership.free_copies.length">{{ card.ownership.free }} owned elsewhere</span>
      <span v-for="d in card.ownership.other_decks" :key="d.deck">{{ d.quantity }} in deck {{ d.deck }}</span>
      <span v-if="card.ownership.in_other_decks && !card.ownership.other_decks.length">{{ card.ownership.in_other_decks }} in other decks</span>
      <span v-if="card.ownership.missing">{{ card.ownership.missing }} missing</span>
      <span v-if="card.ownership.wanted">{{ card.ownership.wanted }} on want list</span>
    </TooltipContent>
  </Tooltip>
</template>
