<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { onKeyStroke } from '@vueuse/core'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import ReplayEvents from '@/components/sims/ReplayEvents.vue'
import ReplayPlayer from '@/components/sims/ReplayPlayer.vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/** A finished game, turn by turn (spec 024, AC-23 to AC-28; spec 025, AC-9). */
const route = useRoute()
const game = ref<Schemas['Replay'] | null>(null)
const notFound = ref(false)
const turn = ref(0)
const event = ref<number | null>(null)

watch(() => [route.params.run, route.params.number], async () => {
  game.value = null
  const { data } = await api.GET('/api/sims/runs/{id}/games/{number}/', {
    params: { path: { id: Number(route.params.run), number: Number(route.params.number) } },
  })
  game.value = data ?? null
  notFound.value = !data
  turn.value = 0
  event.value = null
}, { immediate: true })

// Back returns to the run (spec 025, AC-9).
const back = computed(() => ({ name: 'sim-run', params: { run: route.params.run } }))

const current = computed(() => game.value?.turns[turn.value] ?? null)
const board = computed(() => {
  if (!game.value || !current.value) return null
  const index = event.value !== null ? current.value.events[event.value]?.board : current.value.board
  return game.value.boards[index ?? 0] ?? null
})
const label = (seat: number | null | undefined) => (seat == null ? '' : game.value?.players[seat]?.label ?? '')
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
// Two columns up to four players, three for five or six, one on a phone (AC-26).
const columns = computed(() => ((game.value?.players.length ?? 0) > 4 ? 'md:grid-cols-2 2xl:grid-cols-3' : 'md:grid-cols-2'))

function go(to: number) {
  if (!game.value) return
  turn.value = Math.max(0, Math.min(game.value.turns.length - 1, to))
  event.value = null
}
const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
onKeyStroke('ArrowLeft', (e) => !typing(e) && go(turn.value - 1))
onKeyStroke('ArrowRight', (e) => !typing(e) && go(turn.value + 1))
const slider = computed({ get: () => [turn.value], set: (v: number[] | undefined) => go(v?.[0] ?? 0) })
const tab = ref('replay')
const eventsOpen = ref(false)
</script>

<template>
  <div v-if="game" class="grid gap-4" data-testid="sim-game">
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
          <Button variant="outline" size="icon" aria-label="Previous turn" :disabled="turn === 0" @click="go(turn - 1)"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon" aria-label="Next turn" :disabled="turn >= game.turns.length - 1" @click="go(turn + 1)"><ChevronRightIcon /></Button>
          <span class="font-medium" data-testid="replay-turn">
            <template v-if="current && current.number > 0">Turn {{ current.own_turn }} · {{ label(current.active) }}</template>
            <template v-else>Before the game</template>
          </span>
          <span v-if="current && current.number > 0" class="text-sm text-muted-foreground" data-testid="replay-game-turn">Game turn {{ current.number }} of {{ game.turn }}</span>
          <Slider v-model="slider" :min="0" :max="Math.max(game.turns.length - 1, 0)" :step="1" class="min-w-40 flex-1" label="Turn" />
          <Sheet v-model:open="eventsOpen">
            <SheetTrigger as-child>
              <Button variant="outline" class="lg:hidden"><ListIcon /> Events</Button>
            </SheetTrigger>
            <SheetContent side="right" class="overflow-y-auto">
              <SheetHeader><SheetTitle>Events</SheetTitle><SheetDescription class="sr-only">What happened this turn</SheetDescription></SheetHeader>
              <ReplayEvents :events="current?.events ?? []" :selected="event" class="px-2" @select="(i) => (event = i)" />
            </SheetContent>
          </Sheet>
        </div>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div v-if="board" :class="cn('grid gap-3', columns)" data-testid="replay-board">
            <ReplayPlayer
              v-for="p in game.players" :key="p.seat" :player="p" :seat="board[p.seat]!" :cards="game.cards"
              :active="current?.active === p.seat" :lost-turn="lostTurn(p.seat)"
            />
          </div>
          <aside class="hidden max-h-[75vh] overflow-y-auto rounded-lg border p-2 lg:block">
            <ReplayEvents :events="current?.events ?? []" :selected="event" @select="(i) => (event = i)" />
          </aside>
        </div>
      </TabsContent>

      <TabsContent value="log" class="pt-2">
        <pre class="max-h-[75vh] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap" data-testid="replay-log">{{ game.log.join('\n') }}</pre>
      </TabsContent>
    </Tabs>
  </div>
  <p v-else-if="notFound" class="py-16 text-center text-muted-foreground">This game is not available.</p>
  <div v-else class="grid gap-4"><Skeleton class="h-8 w-64" /><Skeleton class="h-96 w-full" /></div>
</template>
