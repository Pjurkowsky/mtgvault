<script setup lang="ts">
import { computed } from 'vue'
import { HeartIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import ReplayCard from './ReplayCard.vue'

/** One player's panel: name, commander, life, battlefield rows, graveyard and exile (AC-25). */
const props = defineProps<{
  player: Schemas['ReplayPlayer']; seat: Schemas['BoardSeat']; cards: Record<string, Schemas['CardImage']>
  active: boolean; lostTurn: number | null
}>()
const ROWS = [{ key: 'creature', label: 'Creatures' }, { key: 'other', label: 'Other' }, { key: 'land', label: 'Lands' }] as const
const rows = computed(() => ROWS.map((r) => ({ ...r, cards: props.seat.battlefield.filter((c) => (c.row ?? 'other') === r.key) })))
const piles = computed(() => [{ key: 'graveyard', label: 'Graveyard', cards: props.seat.graveyard }, { key: 'exile', label: 'Exile', cards: props.seat.exile }])
</script>

<template>
  <section
    :class="cn('grid content-start gap-2 rounded-lg border p-3', active && 'border-primary ring-1 ring-primary', seat.lost && 'opacity-50')"
    :data-active="active || undefined" :data-lost="seat.lost || undefined" :aria-label="player.label" data-testid="replay-player"
  >
    <header class="flex items-center gap-2">
      <div class="grid min-w-0">
        <span class="truncate font-semibold">{{ player.label }}</span>
        <span class="truncate text-xs text-muted-foreground">{{ player.commanders.join(' & ') }} · {{ player.profile }}</span>
      </div>
      <span class="ml-auto flex items-center gap-1 text-lg font-semibold tabular-nums" data-testid="player-life"><HeartIcon class="size-4 text-destructive" />{{ seat.life }}</span>
    </header>
    <p v-if="seat.lost" class="text-sm font-medium" data-testid="player-lost">Lost on turn {{ lostTurn ?? '?' }}</p>
    <div v-for="row in rows" :key="row.key" class="grid gap-1" :data-testid="`row-${row.key}`">
      <span class="text-xs text-muted-foreground">{{ row.label }} <span class="tabular-nums">{{ row.cards.length }}</span></span>
      <div class="flex min-h-10 flex-wrap items-center gap-1">
        <ReplayCard v-for="c in row.cards" :key="c.id" :card="c" :image="cards[c.name]" />
      </div>
    </div>
    <footer class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <Popover v-for="pile in piles" :key="pile.key">
        <PopoverTrigger as-child>
          <button type="button" class="rounded-md border px-2 py-1 hover:bg-muted" :data-testid="`pile-${pile.key}`">{{ pile.label }} <span class="tabular-nums">{{ pile.cards.length }}</span></button>
        </PopoverTrigger>
        <PopoverContent class="max-h-72 w-64 overflow-y-auto text-sm">
          <ul class="grid gap-0.5" :data-testid="`pile-${pile.key}-list`">
            <li v-for="c in pile.cards" :key="c.id">{{ c.name }}</li>
            <li v-if="!pile.cards.length" class="text-muted-foreground">Empty</li>
          </ul>
        </PopoverContent>
      </Popover>
      <span data-testid="player-hand">Hand <span class="tabular-nums">{{ seat.hand }}</span></span>
      <span data-testid="player-library">Library <span class="tabular-nums">{{ seat.library }}</span></span>
    </footer>
  </section>
</template>
