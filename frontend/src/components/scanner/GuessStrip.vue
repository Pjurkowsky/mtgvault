<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import IconButton from '@/components/IconButton.vue'
import type { Candidate } from '@/scanner/recognition/pipeline'

/** The best guesses for a card the scanner is unsure about; a tap logs one (spec 019, AC-6 to AC-8). */
defineProps<{ guesses: Candidate[] }>()
const emit = defineEmits<{ pick: [candidate: Candidate]; close: [] }>()
</script>

<template>
  <div class="flex items-start gap-2 rounded-xl bg-background/95 p-2 shadow-xl backdrop-blur" data-testid="guesses">
    <div class="grid min-w-0 flex-1 grid-cols-3 gap-2">
      <button
        v-for="g in guesses" :key="g.id" type="button" :aria-label="`${g.name} (${g.set.toUpperCase()})`"
        class="grid min-w-0 gap-1 rounded-lg p-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="guess" @click="emit('pick', g)"
      >
        <img :src="g.url" alt="" class="aspect-[4/3] w-full rounded-md bg-muted object-cover" />
        <span class="truncate text-xs font-medium">{{ g.name }}</span>
        <span class="truncate text-xs text-muted-foreground uppercase">{{ g.set }}<template v-if="g.collector_number"> #{{ g.collector_number }}</template></span>
      </button>
    </div>
    <IconButton label="Close guesses" variant="ghost" size="icon-sm" class="shrink-0" @click="emit('close')"><XIcon /></IconButton>
  </div>
</template>
