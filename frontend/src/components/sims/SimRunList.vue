<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { active, percent, statusLabel, type RunRow } from '@/lib/sims'

/** Runs, newest first, with All / Mine and a search (spec 025, AC-6 to AC-8). */
const props = defineProps<{ runs: RunRow[] | null; total: number; mine: boolean; query: string }>()
const emit = defineEmits<{ 'update:mine': [mine: boolean]; 'update:query': [query: string]; more: [] }>()

const when = (at: string) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const more = computed(() => (props.runs?.length ?? 0) < props.total)
</script>

<template>
  <section class="grid grid-cols-1 gap-3" data-testid="sim-runs">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="text-sm font-semibold">Runs <span class="font-normal text-muted-foreground" data-testid="sim-runs-total">{{ runs ? total : '' }}</span></h2>
      <span class="ml-auto" />
      <ToggleGroup
        type="single" variant="outline" size="sm" :model-value="mine ? 'mine' : 'all'" aria-label="Whose runs"
        @update:model-value="(v) => v && emit('update:mine', v === 'mine')"
      >
        <ToggleGroupItem value="all" class="px-3">All</ToggleGroupItem>
        <ToggleGroupItem value="mine" class="px-3">Mine</ToggleGroupItem>
      </ToggleGroup>
      <Input
        :model-value="query" type="search" placeholder="Deck or commander" aria-label="Search runs" class="h-8 w-full sm:w-56"
        @update:model-value="(v) => emit('update:query', String(v))"
      />
    </div>
    <div v-if="runs === null" class="grid gap-2"><Skeleton v-for="n in 3" :key="n" class="h-16 w-full" /></div>
    <p v-else-if="!runs.length" class="text-sm text-muted-foreground">No runs.</p>
    <ol v-else class="grid grid-cols-1 gap-2">
      <li v-for="run in runs" :key="run.id">
        <RouterLink
          :to="{ name: 'sim-run', params: { run: run.id } }" :data-status="run.status" data-testid="sim-run-row"
          class="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50"
        >
          <img v-if="run.tested.image" :src="run.tested.image" alt="" class="h-10 w-14 shrink-0 rounded object-cover" />
          <div v-else class="h-10 w-14 shrink-0 rounded bg-muted" />
          <div class="grid min-w-0 flex-1 gap-0.5">
            <span class="truncate font-medium" data-testid="run-row-deck">{{ run.tested.label }}</span>
            <span class="truncate text-xs text-muted-foreground" data-testid="run-row-opponents">
              vs {{ run.opponents.map((o) => o.commanders.join(' & ') || o.label).join(', ') }}
            </span>
            <span class="truncate text-xs text-muted-foreground sm:hidden">{{ run.user }} · {{ when(run.created_at) }}</span>
          </div>
          <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">{{ run.user }} · {{ when(run.created_at) }}</span>
          <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
            <Badge :variant="run.status === 'failed' ? 'destructive' : active(run.status) ? 'default' : 'outline'" class="max-w-28 whitespace-normal text-center sm:max-w-none sm:whitespace-nowrap" data-testid="run-row-status">{{ statusLabel(run) }}</Badge>
            <span class="text-right font-semibold tabular-nums sm:w-12" data-testid="run-row-win-rate">{{ run.win_rate == null ? '' : percent(run.win_rate) }}</span>
          </div>
        </RouterLink>
      </li>
    </ol>
    <Button v-if="more" variant="outline" class="justify-self-start" data-testid="sim-runs-more" @click="emit('more')">Show more</Button>
  </section>
</template>
