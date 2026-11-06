<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon } from '@lucide/vue'
import IconButton from '@/components/IconButton.vue'

/** "2 of 5" and previous / next match for the binder search (spec 009, AC-5). `matches` is null without a search. */
defineProps<{ matches: number | null; current: number }>()
const emit = defineEmits<{ step: [by: -1 | 1] }>()
</script>

<template>
  <div v-if="matches !== null" class="flex items-center gap-0.5 text-xs text-muted-foreground" data-testid="binder-matches">
    <span v-if="matches" class="mr-0.5 tabular-nums" data-testid="binder-match-count">{{ current + 1 }} of {{ matches }}</span>
    <span v-else class="mr-0.5" data-testid="binder-match-count">None</span>
    <IconButton label="Previous match" size="icon-xs" :disabled="matches < 2" @click="emit('step', -1)"><ChevronUpIcon /></IconButton>
    <IconButton label="Next match" size="icon-xs" :disabled="matches < 2" @click="emit('step', 1)"><ChevronDownIcon /></IconButton>
  </div>
</template>
