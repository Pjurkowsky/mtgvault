<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { api } from '@/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import type { DeckDetail } from '@/lib/decks'
import { active, type QueueEntry, type Run } from '@/lib/sims'
import SimQueue from './SimQueue.vue'
import SimRunCard from './SimRunCard.vue'
import SimRunForm from './SimRunForm.vue'

/** The Simulate tab: the queue, the run form and the deck's runs (spec 024, AC-3 to AC-22). */
const props = defineProps<{ deck: DeckDetail; username: string | null }>()
const auth = useAuthStore()

const runs = ref<Run[] | null>(null)
const queue = ref<QueueEntry[]>([])
const hasCommander = computed(() => props.deck.cards.some((c) => c.zone === 'commander'))

async function load() {
  const [{ data: list }, { data: q }] = await Promise.all([
    api.GET('/api/decks/{id}/sims/', { params: { path: { id: props.deck.id } } }),
    api.GET('/api/sims/queue/'),
  ])
  runs.value = list ?? []
  queue.value = q ?? []
}
watch(() => props.deck.id, load, { immediate: true })

// Updates every 3 seconds while anything is queued or playing (AC-14).
const busy = computed(() => queue.value.length > 0 || (runs.value ?? []).some((r) => active(r.status)))
let timer: ReturnType<typeof setInterval> | null = null
watch(busy, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(load, 3000) : null
}, { immediate: true })
onUnmounted(() => timer && clearInterval(timer))

function started(run: Run) {
  runs.value = [run, ...(runs.value ?? [])]
  load()
}
</script>

<template>
  <div class="grid gap-6" data-testid="deck-simulate">
    <SimQueue v-if="queue.length" :queue="queue" />
    <template v-if="auth.isLoggedIn">
      <SimRunForm v-if="hasCommander" :deck="deck" @started="started" />
      <p v-else class="text-sm text-muted-foreground">Add a commander to simulate this deck.</p>
    </template>
    <section class="grid gap-3">
      <h2 class="text-sm font-semibold">Runs <span class="font-normal text-muted-foreground">{{ runs?.length ?? '' }}</span></h2>
      <div v-if="runs === null" class="grid gap-3"><Skeleton class="h-32 w-full" /></div>
      <p v-else-if="!runs.length" class="text-sm text-muted-foreground">No runs yet.</p>
      <SimRunCard v-for="run in runs ?? []" :key="run.id" :run="run" :username="username" @changed="load" />
    </section>
    <p class="text-xs text-muted-foreground">
      Games played by the AI of <a href="https://github.com/Card-Forge/forge" target="_blank" rel="noopener" class="underline hover:text-foreground">Forge</a>
    </p>
  </div>
</template>
