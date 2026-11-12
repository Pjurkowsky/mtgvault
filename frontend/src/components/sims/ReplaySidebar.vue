<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon, StepBackIcon, StepForwardIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SPEEDS, type useReplayPlayer } from '@/composables/useReplayPlayer'
import type { Segment } from '@/lib/replay'
import ReplayEvents from './ReplayEvents.vue'

/**
 * The replay's sidebar on the window's right edge, like the binder's Unplaced sidebar (spec 026, AC-9):
 * the turn's events with Previous / Next event (AC-10), then the autoplay and board settings (AC-12, AC-13).
 */
const props = defineProps<{
  player: ReturnType<typeof useReplayPlayer>; events: Schemas['ReplayEvent'][]; players: Schemas['ReplayPlayer'][]; title: string
  split: (text: string) => Segment[]; images: Record<string, Schemas['CardImage']>
}>()

const shown = defineModel<boolean>('open', { required: true })
const toggle = () => (shown.value = !shown.value)

const s = props.player.settings
const on = (r: { value: 'on' | 'off' }) => computed({ get: () => r.value === 'on', set: (v: boolean) => (r.value = v ? 'on' : 'off') })
const combatPause = on(s.combatPause)
const deaths = on(s.deaths)
const graveyard = on(s.graveyard)
</script>

<template>
  <div class="contents" data-testid="replay-sidebar" :data-state="shown ? 'open' : 'closed'">
    <Transition
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      enter-from-class="translate-x-full"
      leave-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      leave-to-class="translate-x-full"
    >
      <aside v-if="shown" id="replay-sidebar" aria-label="Events" class="fixed inset-y-0 right-0 z-30 flex w-80 max-w-[85vw] flex-col border-l bg-card shadow-xl">
        <div class="flex items-center gap-1 border-b p-2">
          <IconButton label="Previous event" variant="outline" :disabled="!player.hasPrevEvent.value" @click="player.prev()"><StepBackIcon /></IconButton>
          <IconButton label="Next event" variant="outline" :disabled="!player.hasNextEvent.value" @click="player.next()"><StepForwardIcon /></IconButton>
          <span class="ml-1 truncate text-sm font-medium" data-testid="sidebar-turn">{{ title }}</span>
        </div>
        <ReplayEvents class="min-h-0 flex-1 overflow-y-auto p-2" :events="events" :selected="player.cursor.value.event" :split="split" :images="images" @select="player.select" />
        <div class="grid gap-3 border-t p-3 text-sm" data-testid="replay-settings">
          <div class="grid gap-1.5">
            <Label id="replay-speed">Speed</Label>
            <ToggleGroup type="single" variant="outline" size="sm" aria-labelledby="replay-speed" class="w-full" :model-value="s.speed.value" @update:model-value="(v) => v && (s.speed.value = v as typeof s.speed.value)">
              <ToggleGroupItem v-for="sp in SPEEDS" :key="sp.value" :value="sp.value" class="flex-1 px-1 text-xs">{{ sp.label }}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div class="grid gap-1.5">
            <Label id="replay-unit">Step by</Label>
            <ToggleGroup type="single" variant="outline" size="sm" aria-labelledby="replay-unit" class="w-full" :model-value="s.unit.value" @update:model-value="(v) => v && (s.unit.value = v as 'event' | 'turn')">
              <ToggleGroupItem value="event" class="flex-1">Event</ToggleGroupItem>
              <ToggleGroupItem value="turn" class="flex-1">Turn</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div class="grid gap-1.5">
            <Label for="replay-follow">Follow</Label>
            <Select v-model="s.follow.value">
              <SelectTrigger id="replay-follow" class="w-full" aria-label="Follow"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem v-for="p in players" :key="p.seat" :value="String(p.seat)">{{ p.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label class="flex items-center justify-between gap-2 font-normal">Pause at combat <Switch v-model="combatPause" aria-label="Pause at combat" /></Label>
          <Label class="flex items-center justify-between gap-2 font-normal">Show deaths on the board <Switch v-model="deaths" aria-label="Show deaths on the board" /></Label>
          <Label class="flex items-center justify-between gap-2 font-normal">Highlight new graveyard cards <Switch v-model="graveyard" aria-label="Highlight new graveyard cards" /></Label>
        </div>
      </aside>
    </Transition>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="fixed top-1/2 z-30 flex -translate-y-1/2 items-center rounded-l-xl border border-r-0 bg-background px-1.5 py-6 text-muted-foreground shadow-lg transition-[right,color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
          :class="shown ? 'right-[min(20rem,85vw)]' : 'right-0'"
          :aria-label="shown ? 'Hide events' : 'Show events'" :aria-expanded="shown" aria-controls="replay-sidebar"
          data-testid="replay-sidebar-tab" @click="toggle"
        >
          <ChevronRightIcon v-if="shown" class="size-6" />
          <ChevronLeftIcon v-else class="size-6" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{{ shown ? 'Hide events' : 'Show events' }}</TooltipContent>
    </Tooltip>
  </div>
</template>
