<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@lucide/vue'
import { api } from '@/api/client'
import SimRunCard from '@/components/sims/SimRunCard.vue'
import { Skeleton } from '@/components/ui/skeleton'
import { active, type Run } from '@/lib/sims'

/** One run with its full results (spec 025, AC-8). */
const route = useRoute()
const router = useRouter()
const run = ref<Run | null>(null)
const notFound = ref(false)

async function load() {
  const { data } = await api.GET('/api/sims/runs/{id}/', { params: { path: { id: Number(route.params.run) } } })
  run.value = data ?? null
  notFound.value = !data
}
watch(() => route.params.run, () => {
  run.value = null
  load()
}, { immediate: true })

// Updates every 3 seconds while queued or playing.
const busy = computed(() => !!run.value && active(run.value.status))
let timer: ReturnType<typeof setInterval> | null = null
watch(busy, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(load, 3000) : null
}, { immediate: true })
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <div class="grid gap-4" data-testid="sim-run-page">
    <RouterLink :to="{ name: 'simulations' }" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon class="size-4" /> Simulations
    </RouterLink>
    <template v-if="run">
      <h1 class="text-2xl font-semibold" data-testid="sim-run-title">{{ run.deck_name }}</h1>
      <SimRunCard :run="run" @changed="load" @deleted="router.push({ name: 'simulations' })" />
    </template>
    <p v-else-if="notFound" class="py-16 text-center text-muted-foreground">This run is not available.</p>
    <Skeleton v-else class="h-96 w-full" />
  </div>
</template>
