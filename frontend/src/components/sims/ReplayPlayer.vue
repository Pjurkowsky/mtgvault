<script setup lang="ts">
import { computed, ref } from 'vue'
import { HeartIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import { showFullscreen } from '@/composables/useFullscreen'
import type { Changes } from '@/lib/replay'
import { cn } from '@/lib/utils'
import ReplayCard from './ReplayCard.vue'
import ReplayZoneDialog from './ReplayZoneDialog.vue'

/**
 * One player's panel: name, commander, life, battlefield rows, then the zones (spec 024, AC-25).
 * Spec 026: zones sit at the bottom and open as images (AC-1 to AC-3); rows keep room for a line
 * of cards (AC-5); cards that just died stay as ghosts (AC-7); new graveyard cards are marked (AC-8).
 */
const props = defineProps<{
  player: Schemas['ReplayPlayer']; seat: Schemas['BoardSeat']; cards: Record<string, Schemas['CardImage']>
  active: boolean; lostTurn: number | null; changes?: Changes; showGhosts?: boolean; showFresh?: boolean
}>()
const ROWS = [{ key: 'creature', label: 'Creatures' }, { key: 'other', label: 'Other' }, { key: 'land', label: 'Lands' }] as const
const rows = computed(() => ROWS.map((r) => {
  const cards = props.seat.battlefield.filter((c) => (c.row ?? 'other') === r.key).map((card) => ({ card, ghost: false }))
  if (props.showGhosts) {
    for (const g of props.changes?.ghosts ?? []) {
      if ((g.card.row ?? 'other') === r.key) cards.splice(Math.min(g.index, cards.length), 0, { card: g.card, ghost: true })
    }
  }
  return { ...r, cards, count: cards.filter((c) => !c.ghost).length }
}))
const fresh = computed(() => (props.showFresh ? props.changes?.newGraveyard : undefined))
const zones = computed(() => [
  { key: 'hand', label: 'Hand', count: props.seat.hand, cards: props.seat.hand_cards },
  { key: 'library', label: 'Library', count: props.seat.library, cards: props.seat.library_cards },
  { key: 'graveyard', label: 'Graveyard', count: props.seat.graveyard.length, cards: props.seat.graveyard, fresh: fresh.value },
  { key: 'exile', label: 'Exile', count: props.seat.exile.length, cards: props.seat.exile },
])
const opened = ref<string | null>(null)
const zone = computed(() => zones.value.find((z) => z.key === opened.value))
</script>

<template>
  <section
    :class="cn('flex flex-col gap-2 rounded-lg border p-3', active && 'border-primary ring-1 ring-primary', seat.lost && 'opacity-50')"
    :data-active="active || undefined" :data-lost="seat.lost || undefined" :data-seat="player.seat" :aria-label="player.label" data-testid="replay-player"
  >
    <header class="flex items-center gap-2" :data-target-seat="player.seat">
      <div class="grid min-w-0">
        <span class="truncate font-semibold">{{ player.label }}</span>
        <span class="truncate text-xs text-muted-foreground">
          <template v-for="(name, i) in player.commanders" :key="name">
            <template v-if="i"> &amp; </template>
            <button type="button" class="cursor-zoom-in hover:text-foreground hover:underline" data-testid="player-commander" @click="showFullscreen(cards[name]?.image_normal, name)">{{ name }}</button>
          </template>
          · {{ player.profile }}
        </span>
      </div>
      <span class="ml-auto flex items-center gap-1 text-lg font-semibold tabular-nums" data-testid="player-life"><HeartIcon class="size-4 text-destructive" />{{ seat.life }}</span>
    </header>
    <p v-if="seat.lost" class="text-sm font-medium" data-testid="player-lost">Lost on turn {{ lostTurn ?? '?' }}</p>
    <div v-for="row in rows" :key="row.key" class="grid gap-1" :data-testid="`row-${row.key}`">
      <span class="text-xs text-muted-foreground">{{ row.label }} <span class="tabular-nums">{{ row.count }}</span></span>
      <!-- Room for one line of cards, empty or not (AC-5) -->
      <div class="flex min-h-[4.9rem] flex-wrap items-center gap-1" data-testid="row-cards">
        <ReplayCard v-for="c in row.cards" :key="c.card.id" :card="c.card" :image="cards[c.card.name]" :ghost="c.ghost" />
      </div>
    </div>
    <footer class="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground" data-testid="player-zones">
      <button
        v-for="z in zones" :key="z.key" type="button"
        :class="cn('rounded-md border px-2 py-1 hover:bg-muted hover:text-foreground', z.fresh?.size && 'border-amber-500 text-foreground')"
        :data-testid="`player-${z.key}`" :data-fresh="z.fresh?.size || undefined" @click="opened = z.key"
      >{{ z.label }} <span class="tabular-nums">{{ z.count }}</span></button>
    </footer>
    <ReplayZoneDialog
      v-if="zone" :open="!!zone" :title="`${player.label}: ${zone.label}`" :zone="zone.key" :cards="zone.cards" :images="cards" :fresh="zone.fresh"
      @update:open="(v) => !v && (opened = null)"
    />
  </section>
</template>
