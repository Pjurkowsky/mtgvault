<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownIcon, ArrowUpIcon, PlayIcon, PlusIcon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { Badge } from '@/components/ui/badge'
import InfoTip from '@/components/InfoTip.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PROFILES, SEAT_MODES, type Opponent, type Profile, type Run, type SeatMode } from '@/lib/sims'
import OpponentPicker from './OpponentPicker.vue'
import SeatTile from './SeatTile.vue'
import SimSwapStep from './SimSwapStep.vue'

/** Seats, AI profiles, seat order, games and time limit (spec 024, AC-3 to AC-7; spec 025, AC-3 to AC-5). */
const emit = defineEmits<{ started: [run: Run] }>()

/** A deck seat's list (spec 027, AC-16): `main`, `branch:<id>` or `version:<id>`. */
type ListOption = { value: string; label: string }
type Seat = { key: number; pick: Opponent | null; profile: Profile; list: string; lists: ListOption[] }
let nextKey = 0
const seat = (pick: Opponent | null = null): Seat => ({ key: nextKey++, pick, profile: 'Default', list: 'main', lists: [] })

// The first seat is the tested deck; it can move but not go (spec 025, AC-3).
const seats = ref<Seat[]>([seat(), seat(), seat(), seat()])
const testedKey = seats.value[0]!.key
const MAX = 6
const games = ref(10)
const minutes = ref(5)
const mode = ref<SeatMode>('rotate')
const busy = ref(false)

const picking = ref<number | null>(null)
const pickerOpen = computed({ get: () => picking.value !== null, set: (v) => !v && (picking.value = null) })
function choose(pick: Opponent) {
  const target = seats.value.find((s) => s.key === picking.value)
  if (target) {
    target.pick = pick
    target.list = 'main'
    target.lists = []
    if (isTested(target)) compared.value = []
    if (pick.source === 'deck') void loadLists(target)
  }
  picking.value = null
}
/** Main (current) first, then each branch's list now and every version. */
async function loadLists(target: Seat) {
  const id = target.pick!.id
  const { data } = await api.GET('/api/sims/decks/{id}/lists/', { params: { path: { id } } })
  const live = seats.value.find((s) => s.key === target.key)
  if (!data || !live || live.pick?.id !== id) return
  const options: ListOption[] = [{ value: 'main', label: 'Main (current)' }]
  for (const b of data.branches) {
    if (!b.is_main) options.push({ value: `branch:${b.id}`, label: `${b.name} (current)` })
    for (const v of b.versions) options.push({ value: `version:${v.id}`, label: `${b.name} v${v.number}${v.name ? ` · ${v.name}` : ''}` })
  }
  live.lists = options
}
function move(i: number, by: number) {
  const list = [...seats.value]
  const [moved] = list.splice(i, 1)
  list.splice(i + by, 0, moved!)
  seats.value = list
}

const valid = computed(() =>
  seats.value.length >= 2 && seats.value.every((s) => s.pick) && Number.isInteger(games.value) && games.value >= 1
  && Number.isInteger(minutes.value) && minutes.value >= 1 && (!compareOn.value || compared.value.length >= 2))
// No upper limit (AC-7); a long run gets a warning. Every compared list plays the set games.
const hours = computed(() => (games.value * minutes.value * (compareOn.value ? compared.value.length : 1)) / 60)
// The run's seat 0 is the tested deck; Fixed mode sends the arranged turn order.
const isTested = (s: Seat) => s.key === testedKey
const ordered = () => [...seats.value].sort((a, b) => Number(isTested(b)) - Number(isTested(a)))
const listSpec = (list: string) => {
  const [kind, id] = list.split(':')
  return kind === 'branch' ? { branch: Number(id) } : kind === 'version' ? { version: Number(id) } : {}
}
const specs = () => ordered().map((s) => ({ ...(s.pick!.source === 'pool' ? { pool: s.pick!.id } : { deck: s.pick!.id, ...listSpec(s.list) }), profile: s.profile }))

// Compare versions: the tested deck plays 2 to 4 of its lists (spec 027, AC-17 to AC-19).
const tested = computed(() => seats.value.find(isTested)!)
const canCompare = computed(() => tested.value.lists.length >= 2)
const comparing = ref(false)
const compared = ref<string[]>([])
const compareMode = ref<'one' | 'separate'>('one')
const MAX_LISTS = 4
function toggleList(value: string, on: boolean) {
  compared.value = on ? [...compared.value, value].slice(-MAX_LISTS) : compared.value.filter((v) => v !== value)
}
const compareOn = computed(() => comparing.value && canCompare.value)
const compareBody = () => (compareOn.value ? { compare: { lists: compared.value.map(listSpec), mode: compareMode.value } } : {})
const order = () => seats.value.map((s) => ordered().indexOf(s))

const checks = ref<Schemas['SeatCheck'][]>([])
const swapping = ref(false)

async function run() {
  if (!valid.value || busy.value) return
  busy.value = true
  const pod = specs()
  const lists = compareOn.value ? compared.value.map((l) => ({ ...pod[0]!, branch: undefined, version: undefined, ...listSpec(l) })) : [pod[0]!]
  const { data: found } = await api.POST('/api/sims/check/', { body: { seats: [...lists, ...pod.slice(1)] } })
  busy.value = false
  if (!found) return toast.error('Could not check the decks.')
  const data = found.slice(lists.length - 1)
  data[0] = { ...data[0]!, unsupported: found.slice(0, lists.length).flatMap((c) => c.unsupported).filter((c, i, all) => all.findIndex((o) => o.name === c.name) === i) }
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
  const { data, error } = await api.POST('/api/sims/runs/', {
    body: {
      seats: specs(), games: games.value, minutes: minutes.value, seat_mode: mode.value, ...(mode.value === 'fixed' ? { order: order() } : {}), ...compareBody(),
    },
  })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not start the run.')
  toast.success('Run queued.')
  emit('started', data)
}
</script>

<template>
  <section class="grid grid-cols-1 gap-4 rounded-lg border p-4" data-testid="sim-form">
    <ol class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="(s, i) in seats" :key="s.key" class="grid gap-2 rounded-md border p-2" data-testid="sim-seat">
        <div class="flex items-center gap-1">
          <span class="text-xs font-medium text-muted-foreground">Seat {{ i + 1 }}</span>
          <Badge v-if="isTested(s)" variant="secondary" class="h-5 px-1.5 text-xs" data-testid="seat-tested">Tested</Badge>
          <span class="ml-auto" />
          <IconButton label="Move up" variant="ghost" size="icon-sm" :disabled="i === 0" @click="move(i, -1)"><ArrowUpIcon /></IconButton>
          <IconButton label="Move down" variant="ghost" size="icon-sm" :disabled="i === seats.length - 1" @click="move(i, 1)"><ArrowDownIcon /></IconButton>
          <IconButton v-if="!isTested(s)" label="Remove seat" variant="ghost" size="icon-sm" :disabled="seats.length <= 2" @click="seats.splice(i, 1)"><XIcon /></IconButton>
        </div>
        <SeatTile v-if="s.pick" :pick="s.pick" button @click="picking = s.key" />
        <Button v-else variant="outline" class="h-16 border-dashed" @click="picking = s.key">{{ isTested(s) ? 'Choose deck' : 'Choose opponent' }}</Button>
        <template v-if="isTested(s) && canCompare">
          <div class="flex items-center gap-2">
            <Switch id="compare-versions" v-model="comparing" data-testid="compare-versions" />
            <Label for="compare-versions" class="font-normal">Compare versions</Label>
            <InfoTip text="Pick 2 to 4 lists of this deck; each plays the same pod, seat orders and seeds" />
          </div>
          <template v-if="comparing">
            <ul class="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2" data-testid="compare-lists">
              <li v-for="o in s.lists" :key="o.value" class="flex items-center gap-2 text-sm">
                <Checkbox
                  :id="`compare-${o.value}`" :model-value="compared.includes(o.value)"
                  @update:model-value="(on) => toggleList(o.value, on === true)"
                />
                <Label :for="`compare-${o.value}`" class="font-normal">{{ o.label }}</Label>
              </li>
            </ul>
            <ToggleGroup :model-value="compareMode" type="single" variant="outline" size="sm" class="justify-self-start" aria-label="Compare as" @update:model-value="(v) => v && (compareMode = v as 'one' | 'separate')">
              <ToggleGroupItem value="one" class="px-3">One run</ToggleGroupItem>
              <ToggleGroupItem value="separate" class="px-3">Separate runs</ToggleGroupItem>
            </ToggleGroup>
          </template>
        </template>
        <Select v-if="s.lists.length > 1 && !(isTested(s) && compareOn)" v-model="s.list">
          <SelectTrigger class="w-full" :aria-label="`List, seat ${i + 1}`" data-testid="seat-list"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="o in s.lists" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
        </Select>
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

    <OpponentPicker
      v-model:open="pickerOpen" :title="picking === testedKey ? 'Choose deck' : 'Choose opponent'" :start="picking === testedKey ? 'mine' : 'pool'"
      @choose="choose"
    />
    <SimSwapStep v-model:open="swapping" :checks="checks" @done="start" />
  </section>
</template>
