<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownIcon, ArrowUpIcon, PlayIcon, PlusIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DeckDetail } from '@/lib/decks'
import { PROFILES, SEAT_MODES, type Opponent, type Profile, type Run, type SeatMode } from '@/lib/sims'
import OpponentPicker from './OpponentPicker.vue'
import SeatTile from './SeatTile.vue'
import SimSwapStep from './SimSwapStep.vue'

/** Seats, AI profiles, seat order, games and time limit (spec 024, AC-3 to AC-7). */
const props = defineProps<{ deck: DeckDetail }>()
const emit = defineEmits<{ started: [run: Run] }>()

type Seat = { key: number; pick: Opponent | null; profile: Profile }
let nextKey = 0
const seat = (pick: Opponent | null = null): Seat => ({ key: nextKey++, pick, profile: 'Default' })

const self = computed<Opponent>(() => ({
  id: props.deck.id, source: 'deck', name: props.deck.name, owner: props.deck.username, precon: false,
  commanders: props.deck.cards.filter((c) => c.zone === 'commander').map((c) => c.printing.name),
  image: props.deck.cards.find((c) => c.zone === 'commander')?.printing.image_normal.replace('/normal/', '/art_crop/') ?? '',
}))
const seats = ref<Seat[]>([seat(), seat(), seat(), seat()])
seats.value[0]!.pick = self.value
const MAX = 6
const games = ref(10)
const minutes = ref(5)
const mode = ref<SeatMode>('rotate')
const busy = ref(false)

const picking = ref<number | null>(null)
const pickerOpen = computed({ get: () => picking.value !== null, set: (v) => !v && (picking.value = null) })
function choose(pick: Opponent) {
  const target = seats.value.find((s) => s.key === picking.value)
  if (target) target.pick = pick
  picking.value = null
}
function move(i: number, by: number) {
  const list = [...seats.value]
  const [moved] = list.splice(i, 1)
  list.splice(i + by, 0, moved!)
  seats.value = list
}

const valid = computed(() =>
  seats.value.length >= 2 && seats.value.every((s) => s.pick) && Number.isInteger(games.value) && games.value >= 1
  && Number.isInteger(minutes.value) && minutes.value >= 1)
// No upper limit (AC-7); a long run gets a warning.
const hours = computed(() => (games.value * minutes.value) / 60)
// Seat 1 of the run is always this deck; Fixed mode sends the arranged turn order.
const isSelf = (s: Seat) => s.pick?.source === 'deck' && s.pick.id === props.deck.id
const ordered = () => [...seats.value].sort((a, b) => Number(isSelf(b)) - Number(isSelf(a)))
const specs = () => ordered().map((s) => ({ ...(s.pick!.source === 'pool' ? { pool: s.pick!.id } : { deck: s.pick!.id }), profile: s.profile }))
const order = () => seats.value.map((s) => ordered().indexOf(s))

const checks = ref<Schemas['SeatCheck'][]>([])
const swapping = ref(false)

async function run() {
  if (!valid.value || busy.value) return
  busy.value = true
  const { data } = await api.POST('/api/sims/check/', { body: { seats: specs() } })
  busy.value = false
  if (!data) return toast.error('Could not check the decks.')
  // Every unsupported card needs a swap before the run (AC-11).
  if (data.some((s) => s.unsupported.length)) {
    checks.value = data
    swapping.value = true
    return
  }
  await start()
}

async function start() {
  busy.value = true
  const { data, error } = await api.POST('/api/decks/{id}/sims/', {
    params: { path: { id: props.deck.id } },
    body: { seats: specs(), games: games.value, minutes: minutes.value, seat_mode: mode.value, ...(mode.value === 'fixed' ? { order: order() } : {}) },
  })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not start the run.')
  toast.success('Run queued.')
  emit('started', data)
}
</script>

<template>
  <section class="grid gap-4 rounded-lg border p-4" data-testid="sim-form">
    <ol class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="(s, i) in seats" :key="s.key" class="grid gap-2 rounded-md border p-2" data-testid="sim-seat">
        <div class="flex items-center gap-1">
          <span class="text-xs font-medium text-muted-foreground">Seat {{ i + 1 }}</span>
          <span class="ml-auto" />
          <IconButton label="Move up" variant="ghost" size="icon-sm" :disabled="i === 0" @click="move(i, -1)"><ArrowUpIcon /></IconButton>
          <IconButton label="Move down" variant="ghost" size="icon-sm" :disabled="i === seats.length - 1" @click="move(i, 1)"><ArrowDownIcon /></IconButton>
          <IconButton v-if="!isSelf(s)" label="Remove seat" variant="ghost" size="icon-sm" :disabled="seats.length <= 2" @click="seats.splice(i, 1)"><XIcon /></IconButton>
        </div>
        <SeatTile v-if="s.pick" :pick="s.pick" :button="!isSelf(s)" @click="picking = s.key" />
        <Button v-else variant="outline" class="h-16 border-dashed" @click="picking = s.key">Choose opponent</Button>
        <Select v-model="s.profile">
          <SelectTrigger class="w-full" :aria-label="`AI profile, seat ${i + 1}`"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="p in PROFILES" :key="p" :value="p">{{ p }}</SelectItem></SelectContent>
        </Select>
      </li>
    </ol>
    <Button v-if="seats.length < MAX" variant="outline" class="justify-self-start" @click="seats.push(seat())"><PlusIcon /> Add seat</Button>

    <div class="flex flex-wrap items-end gap-4">
      <div class="grid gap-1.5">
        <Label for="sim-mode" class="flex items-center gap-1">Seat order <InfoTip :text="SEAT_MODES.find((m) => m.value === mode)!.hint" /></Label>
        <Select v-model="mode">
          <SelectTrigger id="sim-mode" class="w-32" aria-label="Seat order"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="m in SEAT_MODES" :key="m.value" :value="m.value">{{ m.label }}</SelectItem></SelectContent>
        </Select>
      </div>
      <div class="grid gap-1.5">
        <Label for="sim-games">Games</Label>
        <Input id="sim-games" v-model.number="games" type="number" min="1" step="1" class="w-24" />
      </div>
      <div class="grid gap-1.5">
        <Label for="sim-minutes" class="flex items-center gap-1">Time limit (min) <InfoTip text="A game that reaches the limit is a draw" /></Label>
        <Input id="sim-minutes" v-model.number="minutes" type="number" min="1" step="1" class="w-24" />
      </div>
      <Button :disabled="!valid || busy" @click="run"><PlayIcon /> Run</Button>
    </div>
    <p v-if="valid && hours > 8" class="text-sm text-amber-700 dark:text-amber-400" data-testid="sim-long">
      This run could take up to {{ Math.round(hours) }} hours.
    </p>

    <OpponentPicker v-model:open="pickerOpen" :deck="deck" @choose="choose" />
    <SimSwapStep v-model:open="swapping" :checks="checks" @done="start" />
  </section>
</template>
