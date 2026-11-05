<script setup lang="ts">
import { computed } from 'vue'
import type { Bar } from '@/lib/deckStats'

/** A ranked list of thin bars with direct counts; a row click filters the deck (spec 006, AC-16, AC-17). */
const props = defineProps<{ bars: Bar[] }>()
const emit = defineEmits<{ pick: [bar: Bar] }>()
const peak = computed(() => Math.max(1, ...props.bars.map((b) => b.count)))
</script>

<template>
  <ul class="grid gap-0.5">
    <li v-for="bar in bars" :key="bar.key">
      <button
        type="button" class="grid w-full grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-3 rounded px-1.5 py-1 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        :aria-label="`Show ${bar.label}: ${bar.count}`" :data-key="bar.key" data-testid="stat-bar" @click="emit('pick', bar)"
      >
        <span class="truncate">{{ bar.label }}</span>
        <span class="h-3"><span class="block h-full rounded-r bg-series-1" :style="{ width: `${(bar.count / peak) * 100}%` }" /></span>
        <span class="text-right tabular-nums text-muted-foreground">{{ bar.count }}</span>
      </button>
    </li>
  </ul>
</template>
