<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon, ChevronRightIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { active, percent, statusLabel } from '@/lib/sims'

/** Separate runs of a comparison, side by side; each run keeps its own page (spec 027, AC-19). */
const route = useRoute()
const group = ref<Schemas['Group'] | null>(null)
const notFound = ref(false)

async function load() {
  const { data } = await api.GET('/api/sims/groups/{group}/', { params: { path: { group: String(route.params.group) } } })
  group.value = data ?? null
  notFound.value = !data
}
watch(() => route.params.group, () => {
  group.value = null
  load()
}, { immediate: true })

const runs = computed(() => group.value?.runs ?? [])
const title = computed(() => runs.value[0]?.deck_name.split(' · ')[0] ?? '')
const best = computed(() => Math.max(...runs.value.map((r) => (r.stats.finished ? r.stats.win_rate ?? -1 : -1))))
const turns = (n: number | null | undefined) => (n == null ? '–' : String(n))

// Updates every 3 seconds while a run is queued or playing.
const busy = computed(() => runs.value.some((r) => active(r.status)))
let timer: ReturnType<typeof setInterval> | null = null
watch(busy, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(load, 3000) : null
}, { immediate: true })
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <div class="grid gap-4" data-testid="sim-group-page">
    <RouterLink :to="{ name: 'simulations' }" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon class="size-4" /> Simulations
    </RouterLink>
    <template v-if="group">
      <h1 class="text-2xl font-semibold">{{ title }}</h1>
      <Table data-testid="group-runs">
        <TableHeader>
          <TableRow>
            <TableHead>List</TableHead><TableHead>Status</TableHead><TableHead class="text-right">Wins</TableHead>
            <TableHead class="text-right">Win rate</TableHead><TableHead class="text-right">Avg win turn</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in runs" :key="r.id" data-testid="group-run">
            <TableCell class="font-medium">{{ r.deck_name }}</TableCell>
            <TableCell>
              <Badge :variant="r.status === 'failed' ? 'destructive' : active(r.status) ? 'default' : 'outline'" data-testid="group-run-status">{{ statusLabel(r) }}</Badge>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ r.stats.wins }} / {{ r.stats.finished }}</TableCell>
            <TableCell class="text-right font-semibold tabular-nums" :class="r.stats.finished > 0 && r.stats.win_rate === best && 'text-emerald-600'" data-testid="group-run-win-rate">
              {{ percent(r.stats.win_rate) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ turns(r.stats.avg_win_turn) }}</TableCell>
            <TableCell class="text-right">
              <RouterLink :to="{ name: 'sim-run', params: { run: r.id } }" class="inline-flex items-center gap-1 text-primary hover:underline">Run <ChevronRightIcon class="size-4" /></RouterLink>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </template>
    <p v-else-if="notFound" class="py-16 text-center text-muted-foreground">This comparison is not available.</p>
    <Skeleton v-else class="h-64 w-full" />
  </div>
</template>
