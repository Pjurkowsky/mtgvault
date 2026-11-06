<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { paginate } from '@/lib/binder'

/** Under the pages: ‹ 1 2–3 4–5 … 12 › with the current view marked (spec 009, AC-6). */
const props = defineProps<{ views: (number | null)[][]; current: number }>()
const emit = defineEmits<{ go: [index: number] }>()
const entries = computed(() => paginate(props.views, props.current))
</script>

<template>
  <nav class="flex flex-wrap items-center justify-center gap-1" aria-label="Binder pages" data-testid="binder-pagination">
    <IconButton label="Previous page" variant="outline" :disabled="current === 0" @click="emit('go', current - 1)"><ChevronLeftIcon /></IconButton>
    <template v-for="(e, i) in entries" :key="e ? `v${e.index}` : `gap${i}`">
      <Button
        v-if="e" size="sm" class="min-w-9 tabular-nums" :variant="e.index === current ? 'default' : 'ghost'"
        :aria-current="e.index === current ? 'page' : undefined" :aria-label="`Page ${e.label}`" @click="emit('go', e.index)"
      >{{ e.label }}</Button>
      <span v-else class="px-1 text-muted-foreground" aria-hidden="true">…</span>
    </template>
    <IconButton label="Next page" variant="outline" :disabled="current >= views.length - 1" @click="emit('go', current + 1)"><ChevronRightIcon /></IconButton>
  </nav>
</template>
