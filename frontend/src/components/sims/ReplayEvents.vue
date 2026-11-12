<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Schemas } from '@/api/client'
import type { Segment } from '@/lib/replay'
import { cn } from '@/lib/utils'
import ReplayEventText from './ReplayEventText.vue'

/** A turn's events in order; clicking one shows the board at that moment (spec 024, AC-27). The current one stays in view (spec 026, AC-10). */
const props = defineProps<{
  events: Schemas['ReplayEvent'][]; selected: number | null
  split: (text: string) => Segment[]; images: Record<string, Schemas['CardImage']>
}>()
const emit = defineEmits<{ select: [index: number] }>()
const list = ref<HTMLElement | null>(null)
watch(() => [props.selected, props.events], () => nextTick(() => {
  list.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
}))
</script>

<template>
  <ol ref="list" class="grid content-start gap-0.5 text-sm" data-testid="replay-events">
    <li v-for="(e, i) in events" :key="i">
      <button
        type="button" :aria-current="selected === i || undefined" data-testid="replay-event"
        :class="cn('w-full rounded-md px-2 py-1 text-left hover:bg-muted', selected === i && 'bg-primary/10 font-medium')"
        @click="emit('select', i)"
      ><ReplayEventText :text="e.text" :split="split" :images="images" /></button>
    </li>
    <li v-if="!events.length" class="px-2 py-1 text-muted-foreground">Nothing happened.</li>
  </ol>
</template>
