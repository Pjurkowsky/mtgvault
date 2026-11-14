<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronRightIcon, CircleStopIcon, RotateCcwIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import DestructiveButton from '@/components/DestructiveButton.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirm } from '@/composables/useConfirm'
import {
  FORGE_CHOICES, SEAT_MODES, active, duration, forgeLabel, lookaheadLabel, percent, roleLabel, runTime, statusLabel, type ForgeChoice, type Run,
} from '@/lib/sims'
import { cn } from '@/lib/utils'

/** One run: status, the pod, stats and games (spec 024, AC-15 to AC-22; spec 025, AC-8, AC-13, AC-15). */
const props = defineProps<{ run: Run }>()
const emit = defineEmits<{ changed: []; deleted: [] }>()
const confirm = useConfirm()

const status = computed(() => statusLabel(props.run))
const when = computed(() => new Date(props.run.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
const seat = (i: number | null) => (i === null ? null : props.run.seats[i])
/** A seat's name in a game: the tested seat played that game's list (spec 027, AC-18). */
const seatLabel = (g: Run['results'][number], i: number | null) =>
  i === 0 && props.run.variants.length ? props.run.variants[g.variant]?.label : seat(i)?.label
const lists = computed(() => props.run.variants)
const best = computed(() => Math.max(...lists.value.map((v) => v.win_rate ?? -1)))
const turns = (n: number | null | undefined) => (n == null ? '–' : String(n))
/** "Forge 2.0.16 · Look-ahead Normal · Auto": the versions its games played on (spec 029, AC-5; spec 031, AC-5). */
const forgeInfo = computed(() => {
  const versions = [...new Set(props.run.results.map((g) => g.forge_version).filter(Boolean))]
  const rest = `Look-ahead ${lookaheadLabel(props.run.lookahead)} · ${forgeLabel(props.run.forge)}`
  return versions.length ? `Forge ${versions.join(', ')} · ${rest}` : rest
})
/** "Other · Forge 2.0.16" (spec 029, AC-6; spec 031, AC-7). */
const gameForge = (g: Run['results'][number]) =>
  [roleLabel(g.forge_server), g.forge_version && `Forge ${g.forge_version}`].filter(Boolean).join(' · ')

// A clock for the times counting up while the run plays (spec 031, AC-8, AC-9).
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null
watch(() => props.run.status === 'playing', (on) => {
  if (clock) clearInterval(clock)
  clock = on ? setInterval(() => (now.value = Date.now()), 1000) : null
}, { immediate: true })
onBeforeUnmount(() => clock && clearInterval(clock))
const time = computed(() => runTime(props.run, now.value))

// Restart a failed or cancelled run (spec 031, AC-6).
const restartOpen = ref(false)
const restartForge = ref<ForgeChoice>('auto')
const restarting = ref(false)
function openRestart() {
  restartForge.value = props.run.forge
  restartOpen.value = true
}
async function restart() {
  restarting.value = true
  const { error } = await api.POST('/api/sims/runs/{id}/restart/', { params: { path: { id: props.run.id } }, body: { forge: restartForge.value } })
  restarting.value = false
  if (error) return toast.error('Could not restart the run.')
  restartOpen.value = false
  toast.success('Run queued.')
  emit('changed')
}
const gameRoute = (number: number) => ({ name: 'sim-game', params: { run: props.run.id, number } })

async function cancel() {
  if (!(await confirm({ title: 'Cancel this run?', description: 'Finished games are kept.', action: 'Cancel run' }))) return
  const { error } = await api.POST('/api/sims/runs/{id}/cancel/', { params: { path: { id: props.run.id } } })
  if (error) return toast.error('Could not cancel the run.')
  emit('changed')
}
async function remove() {
  if (!(await confirm({ title: 'Delete this run?', description: 'Its games and replays go too.' }))) return
  const { error } = await api.DELETE('/api/sims/runs/{id}/', { params: { path: { id: props.run.id } } })
  if (error) return toast.error('Could not delete the run.')
  toast.success('Run deleted.')
  emit('deleted')
}
</script>

<template>
  <article class="grid min-w-0 gap-4 rounded-lg border p-4" data-testid="sim-run" :data-status="run.status">
    <header class="flex flex-wrap items-center gap-2 text-sm">
      <Badge :variant="run.status === 'failed' ? 'destructive' : active(run.status) ? 'default' : 'outline'" data-testid="run-status">{{ status }}</Badge>
      <span class="text-muted-foreground">
        {{ run.user }} · {{ when }} ·
        <template v-if="lists.length">{{ lists.length }} lists × {{ run.games / lists.length }} {{ run.games / lists.length === 1 ? 'game' : 'games' }}</template>
        <template v-else>{{ run.games }} {{ run.games === 1 ? 'game' : 'games' }}</template>, {{ run.minutes }} min each · {{ SEAT_MODES.find((m) => m.value === run.seat_mode)?.label }}
      </span>
      <span data-testid="run-forge"><InfoTip :text="forgeInfo" /></span>
      <span v-if="time" class="text-muted-foreground tabular-nums" data-testid="run-time">{{ time }}</span>
      <span class="ml-auto" />
      <span v-if="run.stats.finished && !lists.length" class="font-semibold" data-testid="run-win-rate">Win rate {{ percent(run.stats.win_rate) }}</span>
      <Button v-if="run.can_cancel && active(run.status) && !run.cancelling" size="sm" variant="outline" @click="cancel"><CircleStopIcon /> Cancel</Button>
      <Button v-if="run.can_restart" size="sm" variant="outline" @click="openRestart"><RotateCcwIcon /> Restart</Button>
      <DestructiveButton v-if="run.mine && !active(run.status)" size="sm" @click="remove">Delete</DestructiveButton>
    </header>
    <Alert v-if="run.error" variant="destructive" class="bg-destructive/10"><AlertDescription>{{ run.error }}</AlertDescription></Alert>

    <!-- Compare versions: each list side by side (spec 027, AC-18) -->
    <Table v-if="lists.length" data-testid="run-lists">
      <TableHeader>
        <TableRow>
          <TableHead>List</TableHead><TableHead class="text-right">Games</TableHead><TableHead class="text-right">Wins</TableHead>
          <TableHead class="text-right">Win rate</TableHead><TableHead class="text-right">Avg win turn</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="v in lists" :key="v.index" data-testid="run-list">
          <TableCell>
            <details>
              <summary class="cursor-pointer font-medium">{{ v.label }}</summary>
              <ul class="mt-1 columns-2 text-xs text-muted-foreground sm:columns-3">
                <li v-for="c in v.cards" :key="`${c.commander}-${c.name}`">{{ c.quantity }} {{ c.name }}</li>
              </ul>
            </details>
          </TableCell>
          <TableCell class="text-right tabular-nums">{{ v.played }} / {{ run.games / lists.length }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ v.wins }}</TableCell>
          <TableCell class="text-right font-semibold tabular-nums" :class="v.finished > 0 && v.win_rate === best && 'text-emerald-600'" data-testid="run-list-win-rate">{{ percent(v.win_rate) }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ turns(v.avg_win_turn) }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <dl v-if="run.stats.finished && !lists.length" class="flex flex-wrap gap-6 text-sm" data-testid="run-summary">
      <div><dt class="text-muted-foreground">Wins</dt><dd class="text-lg font-semibold tabular-nums">{{ run.stats.wins }} / {{ run.stats.finished }}</dd></div>
      <div><dt class="text-muted-foreground">Average winning turn</dt><dd class="text-lg font-semibold tabular-nums" data-testid="run-avg-turn">{{ turns(run.stats.avg_win_turn) }}</dd></div>
    </dl>

    <Table data-testid="run-pod">
      <TableHeader>
        <TableRow>
          <TableHead>Deck</TableHead><TableHead>AI</TableHead>
          <TableHead class="text-right">Wins</TableHead><TableHead class="text-right">Draws</TableHead>
          <TableHead class="text-right">Avg win turn</TableHead><TableHead class="text-right">Went first</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="s in run.seats" :key="s.index" :class="cn(s.index === 0 && 'font-medium')" data-testid="pod-row">
          <TableCell>
            <details>
              <summary class="cursor-pointer">
                {{ s.index === 0 && lists.length ? run.deck_name : s.label }} <span class="font-normal text-muted-foreground">· {{ s.commanders.join(' & ') }} · {{ s.owner }}</span>
              </summary>
              <ul class="mt-1 columns-2 text-xs font-normal text-muted-foreground sm:columns-3" data-testid="pod-list">
                <li v-for="c in s.cards" :key="`${c.commander}-${c.name}`">{{ c.quantity }} {{ c.name }}</li>
              </ul>
            </details>
          </TableCell>
          <TableCell>{{ s.profile }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ run.stats.seats[s.index]?.wins ?? 0 }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ run.stats.seats[s.index]?.draws ?? 0 }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ turns(run.stats.seats[s.index]?.avg_win_turn) }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ run.stats.seats[s.index]?.went_first ?? 0 }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <ol v-if="run.results.length || run.playing.length" class="grid gap-1 text-sm" data-testid="run-games">
      <li v-for="g in run.results" :key="g.number" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1 hover:bg-muted/50" data-testid="run-game">
        <Tooltip :disabled="!gameForge(g)">
          <TooltipTrigger as-child>
            <span class="w-16 text-muted-foreground" data-testid="game-number">Game {{ g.number }}</span>
          </TooltipTrigger>
          <TooltipContent>{{ gameForge(g) }}</TooltipContent>
        </Tooltip>
        <span class="font-medium" data-testid="game-result">
          <template v-if="g.status === 'won'">{{ seatLabel(g, g.winner_seat) }} won on turn {{ g.winner_turn }}</template>
          <template v-else-if="g.status === 'draw'">Draw on game turn {{ g.turn }}</template>
          <span v-else class="text-destructive">Failed</span>
        </span>
        <span class="truncate text-muted-foreground" data-testid="game-seats">{{ g.seat_order.map((i) => seatLabel(g, i)).join(' → ') }}</span>
        <span class="flex items-center gap-1 text-xs text-muted-foreground tabular-nums" data-testid="game-where">
          <Tooltip v-if="g.forge_url" :disabled="!gameForge(g)">
            <TooltipTrigger as-child><span data-testid="game-url">{{ g.forge_url }}</span></TooltipTrigger>
            <TooltipContent>{{ gameForge(g) }}</TooltipContent>
          </Tooltip>
          <template v-if="g.forge_url"> · </template>
          <span data-testid="game-time">{{ duration(g.duration_ms) }}</span>
        </span>
        <span v-if="g.status === 'failed'" class="w-full truncate text-xs text-destructive" :title="g.error">{{ g.error }}</span>
        <RouterLink v-else :to="gameRoute(g.number)" class="ml-auto flex items-center gap-1 text-primary hover:underline">Replay <ChevronRightIcon class="size-4" /></RouterLink>
      </li>
      <!-- Games playing now (spec 031, AC-8) -->
      <li v-for="p in run.playing" :key="`playing-${p.number}`" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1" data-testid="run-playing">
        <span class="w-16 text-muted-foreground">Game {{ p.number }}</span>
        <span class="font-medium">Playing on <span data-testid="playing-url">{{ p.url }}</span></span>
        <span class="text-xs text-muted-foreground tabular-nums" data-testid="playing-time">{{ duration(now - Date.parse(p.started_at)) }}</span>
      </li>
    </ol>

    <Dialog v-model:open="restartOpen">
      <DialogContent class="sm:max-w-sm" data-testid="restart-dialog">
        <DialogHeader>
          <DialogTitle>Restart run</DialogTitle>
          <DialogDescription>Finished games are kept; the rest play again.</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          :model-value="restartForge" type="single" variant="outline" aria-label="Forge" class="justify-self-start"
          @update:model-value="(v) => v && (restartForge = v as ForgeChoice)"
        >
          <ToggleGroupItem v-for="f in FORGE_CHOICES" :key="f.value" :value="f.value" class="px-3">{{ f.label }}</ToggleGroupItem>
        </ToggleGroup>
        <DialogFooter><Button :disabled="restarting" @click="restart"><RotateCcwIcon /> Restart</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </article>
</template>
