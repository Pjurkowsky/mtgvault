<script setup lang="ts">
import { computed } from 'vue'
import { HeartIcon } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { OWN_STATES, type DeckCard, type OwnState } from '@/lib/decks'

/**
 * Ownership state of a deck card with details on hover (spec 004, AC-13). `counts` adds
 * how many are missing to the label, "Missing 1 of 2" (spec 021, AC-22).
 */
const props = defineProps<{ card: DeckCard; showLabel?: boolean; counts?: boolean }>()
const label = computed(() => {
  const own = props.card.ownership
  const text = OWN_STATES[own.state as OwnState].label
  if (!props.counts || !own.missing) return text
  return own.state === 'missing' ? `${text} ${own.missing} of ${own.needed}` : `${text} · ${own.missing} missing`
})
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <!-- w-fit: in a grid the badge would stretch, and the tooltip would anchor to the far edge (spec 021, AC-22). -->
      <span class="inline-flex w-fit items-center gap-1.5 text-xs" tabindex="0" :data-state="card.ownership.state" data-testid="ownership">
        <span :class="['size-2 shrink-0 rounded-full', OWN_STATES[card.ownership.state as OwnState].dot]" />
        <!-- On the want list (spec 010, AC-14) -->
        <HeartIcon v-if="card.ownership.wanted" class="size-3 shrink-0 fill-current text-rose-500" aria-label="On want list" data-testid="wanted" />
        <span v-if="showLabel" :class="counts && card.ownership.missing > 0 && 'text-destructive'" data-testid="ownership-label">{{ label }}</span>
        <span v-else class="sr-only">{{ OWN_STATES[card.ownership.state as OwnState].label }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent class="grid max-w-64 gap-0.5 text-xs" :collision-padding="8">
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
