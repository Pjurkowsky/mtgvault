<script setup lang="ts">
import CheckGroup from '@/components/browser/filters/CheckGroup.vue'
import ColorToggles from '@/components/browser/filters/ColorToggles.vue'
import { CONDITIONS, FINISHES, RARITIES, TYPES } from '@/lib/cards'

/**
 * A section's filter, inline in Binder settings (spec 009, AC-13). Sets and
 * price ranges set earlier stay in the filter untouched.
 */
const props = defineProps<{ filter: Record<string, unknown> }>()
const emit = defineEmits<{ update: [patch: Record<string, string[]>] }>()
const GROUPS = [
  { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: t })) },
  { key: 'rarity', label: 'Rarity', options: RARITIES },
  { key: 'finish', label: 'Finish', options: FINISHES },
  { key: 'condition', label: 'Condition', options: CONDITIONS },
] as const
const list = (key: string) => (Array.isArray(props.filter[key]) ? (props.filter[key] as string[]) : [])
</script>

<template>
  <div class="grid gap-4 rounded-md border bg-muted/30 p-3" data-testid="section-filter">
    <ColorToggles :selected="list('color')" @change="(v) => emit('update', { color: v })" />
    <div class="grid gap-4 sm:grid-cols-2">
      <CheckGroup
        v-for="g in GROUPS" :key="g.key" :label="g.label" :options="g.options" :selected="list(g.key)"
        @change="(v) => emit('update', { [g.key]: v })"
      />
    </div>
  </div>
</template>
