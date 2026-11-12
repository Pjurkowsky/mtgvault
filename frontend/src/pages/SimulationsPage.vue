<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import { api } from '@/api/client'
import SimQueue from '@/components/sims/SimQueue.vue'
import SimRunForm from '@/components/sims/SimRunForm.vue'
import SimRunList from '@/components/sims/SimRunList.vue'
import { active, useForge, type QueueEntry, type RunRow } from '@/lib/sims'

/** The queue, the run form and every run (spec 025, AC-1, AC-3 to AC-8, AC-11). */
const route = useRoute()
const router = useRouter()
const PAGE = 20
const forge = useForge()

// All / Mine and the search live in the URL (spec 025, assumption on AC-7).
const mine = computed(() => route.query.mine === '1')
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')

// Takes the box's search too, in case its debounce hasn't written it yet.
const setMine = (on: boolean) => router.replace({ query: { ...route.query, mine: on ? '1' : undefined, q: query.value.trim() || undefined } })
watchDebounced(query, (q) => router.replace({ query: { ...route.query, q: q.trim() || undefined } }), { debounce: 250 })

const runs = ref<RunRow[] | null>(null)
const total = ref(0)
const queue = ref<QueueEntry[]>([])

async function page(offset: number) {
  const { data } = await api.GET('/api/sims/runs/', {
    params: { query: { mine: mine.value || undefined, q: (route.query.q as string) || undefined, offset } },
  })
  return data ?? { results: [], total: 0 }
}
/** Reload the queue and as many runs as are shown. */
async function load() {
  const shown = Math.max(runs.value?.length ?? 0, PAGE)
  const [q, ...pages] = await Promise.all([
    api.GET('/api/sims/queue/'),
    ...Array.from({ length: Math.ceil(shown / PAGE) }, (_, i) => page(i * PAGE)),
  ])
  queue.value = q.data ?? []
  runs.value = pages.flatMap((p) => p.results)
  total.value = pages[0]?.total ?? 0
}
async function more() {
  const next = await page(runs.value?.length ?? 0)
  runs.value = [...(runs.value ?? []), ...next.results]
  total.value = next.total
}
watch(() => [route.query.mine, route.query.q], () => {
  runs.value = null
  load()
}, { immediate: true })

// Updates every 3 seconds while anything is queued or playing (spec 024 AC-14).
const busy = computed(() => queue.value.length > 0 || (runs.value ?? []).some((r) => active(r.status)))
let timer: ReturnType<typeof setInterval> | null = null
watch(busy, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(load, 3000) : null
}, { immediate: true })
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <div class="grid grid-cols-1 gap-6" data-testid="simulations">
    <SimQueue v-if="queue.length" :queue="queue" @changed="load" />
    <SimRunForm v-if="forge" @started="load" />
    <SimRunList :runs="runs" :total="total" :mine="mine" :query="query" @update:mine="setMine" @update:query="(q) => (query = q)" @more="more" />
    <p class="text-xs text-muted-foreground">
      Games played by the AI of <a href="https://github.com/Card-Forge/forge" target="_blank" rel="noopener" class="underline hover:text-foreground">Forge</a>
    </p>
  </div>
</template>
