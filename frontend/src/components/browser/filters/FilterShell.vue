<script setup lang="ts">
import { SlidersHorizontalIcon } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** The Filters button with its active count, and the panel with Clear (collection and decks). */
defineProps<{ activeCount: number }>()
const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline">
        <SlidersHorizontalIcon /> Filters
        <Badge v-if="activeCount" variant="secondary" class="ml-1 px-1.5">{{ activeCount }}</Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="grid max-h-[70vh] w-80 gap-4 overflow-y-auto" data-testid="filter-panel">
      <div class="flex items-center justify-between">
        <span class="font-medium">Filters</span>
        <Button variant="ghost" size="sm" :disabled="!activeCount" @click="emit('clear')">Clear</Button>
      </div>
      <slot />
    </PopoverContent>
  </Popover>
</template>
