<script setup lang="ts">
import type { Schemas } from '@/api/client'
import { cn } from '@/lib/utils'

/** A turn's events in order; clicking one shows the board at that moment (AC-27). */
defineProps<{ events: Schemas['ReplayEvent'][]; selected: number | null }>()
const emit = defineEmits<{ select: [index: number] }>()
</script>

<template>
  <ol class="grid gap-0.5 text-sm" data-testid="replay-events">
    <li v-for="(e, i) in events" :key="i">
      <button
        type="button" :aria-current="selected === i || undefined" data-testid="replay-event"
        :class="cn('w-full rounded-md px-2 py-1 text-left hover:bg-muted', selected === i && 'bg-primary/10 font-medium')"
        @click="emit('select', i)"
      >{{ e.text }}</button>
    </li>
    <li v-if="!events.length" class="px-2 py-1 text-muted-foreground">Nothing happened.</li>
  </ol>
</template>
