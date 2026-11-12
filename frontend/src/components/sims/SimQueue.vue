<script setup lang="ts">
import { computed } from 'vue'
import { CircleStopIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/composables/useConfirm'
import { cn } from '@/lib/utils'
import type { QueueEntry } from '@/lib/sims'
import { useAuthStore } from '@/stores/auth'

/**
 * The run playing and the queued ones, in order; the user's own highlighted (spec 024 AC-14).
 * Private runs stay unnamed; admins cancel any run or all of them (spec 025, AC-11 to AC-14).
 */
const props = defineProps<{ queue: QueueEntry[] }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore()
const confirm = useConfirm()

const rows = computed(() => {
  let place = 0
  return props.queue.map((entry) => ({ entry, label: entry.status === 'playing' ? 'Playing' : `Queued ${++place}` }))
})

async function cancel(entry: QueueEntry) {
  if (!(await confirm({ title: entry.mine ? 'Cancel this run?' : `Cancel ${entry.user}'s run?`, description: 'Finished games are kept.', action: 'Cancel run' }))) return
  const { error } = await api.POST('/api/sims/runs/{id}/cancel/', { params: { path: { id: entry.id } } })
  if (error) return toast.error('Could not cancel the run.')
  emit('changed')
}
async function cancelAll() {
  if (!(await confirm({
    title: 'Cancel every run?', description: 'The playing run stops, keeping its finished games, and every queued run is cancelled.', action: 'Cancel all',
  }))) return
  const { data } = await api.POST('/api/sims/queue/cancel/')
  if (!data) return toast.error('Could not cancel the queue.')
  toast.success(`Cancelled ${data.cancelled} ${data.cancelled === 1 ? 'run' : 'runs'}.`)
  emit('changed')
}
</script>

<template>
  <section class="grid grid-cols-1 gap-2 rounded-lg border p-3" data-testid="sim-queue">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold">Queue</h2>
      <Button v-if="auth.user?.is_staff" size="sm" variant="outline" class="ml-auto h-7" data-testid="queue-cancel-all" @click="cancelAll">
        <CircleStopIcon /> Cancel all
      </Button>
    </div>
    <ol class="grid grid-cols-1 gap-1 text-sm">
      <li
        v-for="{ entry, label } in rows" :key="entry.id" :data-mine="entry.mine || undefined" data-testid="queue-entry"
        :class="cn('flex items-center gap-2 rounded-md px-2 py-1', entry.mine && 'bg-primary/10')"
      >
        <span class="w-20 shrink-0 text-xs text-muted-foreground">{{ label }}</span>
        <RouterLink v-if="entry.visible" :to="{ name: 'sim-run', params: { run: entry.id } }" class="truncate font-medium hover:underline" data-testid="queue-deck">{{ entry.deck_name }}</RouterLink>
        <span v-else class="truncate font-medium text-muted-foreground" data-testid="queue-deck">{{ entry.deck_name }}</span>
        <span class="truncate text-muted-foreground">{{ entry.user }}</span>
        <span class="ml-auto shrink-0 tabular-nums text-muted-foreground">{{ entry.played }} / {{ entry.games }}</span>
        <IconButton
          v-if="entry.can_cancel" label="Cancel run" variant="ghost" size="icon-sm" class="-my-1" data-testid="queue-cancel"
          @click="cancel(entry)"
        ><CircleStopIcon /></IconButton>
      </li>
    </ol>
  </section>
</template>
