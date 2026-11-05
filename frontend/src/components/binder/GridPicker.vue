<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'

/** Pockets per page: hover a 6 × 6 grid like inserting a table, click to pick (spec 007, AC-7). Sizes are rows × columns. */
const model = defineModel<{ rows: number; cols: number }>({ required: true })
const MAX = 6
const SHORTCUTS = [[2, 2], [3, 3], [4, 3], [4, 4]] as const
const hover = ref<{ rows: number; cols: number } | null>(null)
const shown = computed(() => hover.value ?? model.value)
const cells = Array.from({ length: MAX * MAX }, (_, i) => ({ row: Math.floor(i / MAX) + 1, col: (i % MAX) + 1 }))
</script>

<template>
  <div class="grid gap-3" data-testid="grid-picker">
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">Pockets per page</span>
      <span class="text-sm font-semibold tabular-nums" data-testid="grid-size">{{ shown.rows }} × {{ shown.cols }}</span>
    </div>
    <div class="grid w-fit grid-cols-6 gap-1" role="group" aria-label="Pockets per page" @mouseleave="hover = null">
      <button
        v-for="c in cells" :key="`${c.row}-${c.col}`" type="button"
        class="size-7 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        :class="c.row <= shown.rows && c.col <= shown.cols ? 'border-primary bg-primary/80' : 'bg-muted hover:bg-muted-foreground/20'"
        :aria-label="`${c.row} rows, ${c.col} columns`" :aria-pressed="c.row === model.rows && c.col === model.cols"
        @mouseenter="hover = { rows: c.row, cols: c.col }"
        @click="model = { rows: c.row, cols: c.col }"
      />
    </div>
    <div class="flex flex-wrap gap-2">
      <Button
        v-for="[rows, cols] in SHORTCUTS" :key="`${rows}x${cols}`" size="sm" type="button"
        :variant="model.rows === rows && model.cols === cols ? 'default' : 'outline'" @click="model = { rows, cols }"
      >{{ rows }} × {{ cols }}</Button>
    </div>
  </div>
</template>
