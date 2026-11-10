<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import type { QueueEntry } from '@/lib/sims'

/** The run playing and the queued ones, in order; the user's own highlighted (AC-14). */
const props = defineProps<{ queue: QueueEntry[] }>()
const rows = computed(() => {
  let place = 0
  return props.queue.map((entry) => ({ entry, label: entry.status === 'playing' ? 'Playing' : `Queued ${++place}` }))
})
</script>

<template>
  <section class="grid gap-2 rounded-lg border p-3" data-testid="sim-queue">
    <h2 class="text-sm font-semibold">Queue</h2>
    <ol class="grid gap-1 text-sm">
      <li
        v-for="{ entry, label } in rows" :key="entry.id" :data-mine="entry.mine || undefined" data-testid="queue-entry"
        :class="cn('flex items-center gap-2 rounded-md px-2 py-1', entry.mine && 'bg-primary/10')"
      >
        <span class="w-20 shrink-0 text-xs text-muted-foreground">{{ label }}</span>
        <span class="truncate font-medium">{{ entry.deck_name }}</span>
        <span class="truncate text-muted-foreground">{{ entry.user }}</span>
        <span class="ml-auto shrink-0 tabular-nums text-muted-foreground">{{ entry.played }} / {{ entry.games }}</span>
      </li>
    </ol>
  </section>
</template>
