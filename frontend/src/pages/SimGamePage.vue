<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { onKeyStroke } from '@vueuse/core'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import ReplayArrows from '@/components/sims/ReplayArrows.vue'
import ReplayPlayer from '@/components/sims/ReplayPlayer.vue'
import ReplaySidebar from '@/components/sims/ReplaySidebar.vue'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePreference } from '@/composables/usePreference'
import { useReplayPlayer } from '@/composables/useReplayPlayer'
import { changes } from '@/lib/replay'
import { cn } from '@/lib/utils'

/** A finished game, turn by turn (spec 024, AC-23 to AC-28; spec 025, AC-9), event by event and on autoplay (spec 026). */
const route = useRoute()
const game = ref<Schemas['Replay'] | null>(null)
const notFound = ref(false)
const player = useReplayPlayer(game)
const { cursor, board, settings, playing } = player

watch(() => [route.params.run, route.params.number], async () => {
  game.value = null
  player.reset()
  const { data } = await api.GET('/api/sims/runs/{id}/games/{number}/', {
    params: { path: { id: Number(route.params.run), number: Number(route.params.number) } },
  })
  game.value = data ?? null
  notFound.value = !data
}, { immediate: true })

// Back returns to the run (spec 025, AC-9).
const back = computed(() => ({ name: 'sim-run', params: { run: route.params.run } }))

const current = computed(() => game.value?.turns[cursor.value.turn] ?? null)
const changed = computed(() => changes(player.previousBoard.value, board.value))
const label = (seat: number | null | undefined) => (seat == null ? '' : game.value?.players[seat]?.label ?? '')
const turnTitle = computed(() => (current.value && current.value.number > 0 ? `Turn ${current.value.own_turn} · ${label(current.value.active)}` : 'Before the game'))
const result = computed(() => {
  const g = game.value
  if (!g) return ''
  if (g.status === 'won') return `${label(g.winner_seat)} won on turn ${g.winner_turn}`
  return g.status === 'draw' ? 'Draw' : 'Failed'
})
/** A player's own turn count when they lost (Terms: turns are counted per player). */
function lostTurn(seat: number) {
  const at = game.value?.players[seat]?.lost_on
  if (at == null || !game.value) return null
  return game.value.turns.filter((t) => t.active === seat && t.number > 0 && t.number <= at).length
}
// Two columns up to four players, three for five or six, one on a phone (spec 024, AC-26).
const columns = computed(() => ((game.value?.players.length ?? 0) > 4 ? 'md:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-2'))

// ← → an event, Shift + ← → a turn (spec 026, AC-10). Not while typing, on the slider or in a dialog.
const ignore = (e: KeyboardEvent) => {
  const t = e.target
  return tab.value !== 'replay' || (t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest('[role="slider"], [role="dialog"]')))
}
onKeyStroke('ArrowLeft', (e) => !ignore(e) && (e.shiftKey ? player.prevTurn() : player.prev()))
onKeyStroke('ArrowRight', (e) => !ignore(e) && (e.shiftKey ? player.nextTurn() : player.next()))
const slider = computed({ get: () => [cursor.value.turn], set: (v: number[] | undefined) => player.goTurn(v?.[0] ?? 0) })
const tab = ref('replay')
watch(tab, () => player.pause())
const boardEl = ref<HTMLElement | null>(null)
// The sidebar starts open on a wide screen and closed on a phone, then is remembered (AC-9).
const wide = typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1280px)').matches
const sidebar = usePreference('replay.sidebar', wide ? 'open' : 'closed', ['open', 'closed'] as const)
const sidebarOpen = computed({ get: () => sidebar.value === 'open', set: (v: boolean) => (sidebar.value = v ? 'open' : 'closed') })
</script>

<template>
  <!-- A wide screen leaves room for the open sidebar, so it covers none of the board -->
  <div v-if="game" :class="cn('grid gap-4', sidebarOpen && 'xl:pr-80')" data-testid="sim-game">
    <RouterLink :to="back" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon class="size-4" /> {{ game.run.deck_name }}
    </RouterLink>
    <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 class="text-2xl font-semibold">Game {{ game.number }}</h1>
      <span class="text-muted-foreground" data-testid="game-result">{{ result }}</span>
    </header>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="replay">Replay</TabsTrigger>
        <TabsTrigger value="log">Log</TabsTrigger>
      </TabsList>

      <TabsContent value="replay" class="grid gap-4 pt-2">
        <div class="flex flex-wrap items-center gap-3">
          <IconButton label="Previous turn" :disabled="cursor.turn === 0" @click="player.prevTurn()"><ChevronLeftIcon /></IconButton>
          <IconButton :label="playing ? 'Pause' : 'Play'" data-testid="replay-play" @click="player.toggle()">
            <PauseIcon v-if="playing" /><PlayIcon v-else />
          </IconButton>
          <IconButton label="Next turn" :disabled="cursor.turn >= game.turns.length - 1" @click="player.nextTurn()"><ChevronRightIcon /></IconButton>
          <span class="font-medium" data-testid="replay-turn">{{ turnTitle }}</span>
          <span v-if="current && current.number > 0" class="text-sm text-muted-foreground" data-testid="replay-game-turn">Game turn {{ current.number }} of {{ game.turn }}</span>
          <Slider v-model="slider" :min="0" :max="Math.max(game.turns.length - 1, 0)" :step="1" class="min-w-40 flex-1" label="Turn" />
        </div>

        <div v-if="board" ref="boardEl" :class="cn('relative grid gap-3', columns)" data-testid="replay-board">
          <ReplayPlayer
            v-for="p in game.players" :key="p.seat" :player="p" :seat="board[p.seat]!" :cards="game.cards"
            :active="current?.active === p.seat" :lost-turn="lostTurn(p.seat)" :changes="changed[p.seat]"
            :show-ghosts="settings.deaths.value === 'on'" :show-fresh="settings.graveyard.value === 'on'"
          />
          <ReplayArrows :board="board" :container="boardEl" />
        </div>
        <ReplaySidebar v-model:open="sidebarOpen" :player="player" :events="current?.events ?? []" :players="game.players" :title="turnTitle" />
      </TabsContent>

      <TabsContent value="log" class="pt-2">
        <pre class="max-h-[75vh] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap" data-testid="replay-log">{{ game.log.join('\n') }}</pre>
      </TabsContent>
    </Tabs>
  </div>
  <p v-else-if="notFound" class="py-16 text-center text-muted-foreground">This game is not available.</p>
  <div v-else class="grid gap-4"><Skeleton class="h-8 w-64" /><Skeleton class="h-96 w-full" /></div>
</template>
