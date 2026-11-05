<script setup lang="ts">
import { computed } from 'vue'
import CheckGroup from '@/components/browser/filters/CheckGroup.vue'
import ColorToggles from '@/components/browser/filters/ColorToggles.vue'
import FilterShell from '@/components/browser/filters/FilterShell.vue'
import { Separator } from '@/components/ui/separator'
import { RARITIES, TYPES } from '@/lib/cards'
import { activeCount, type DeckFilter, type ListKey } from '@/lib/deckFilter'
import { OWN_STATES, type DeckCard } from '@/lib/decks'

/** The collection's filter menu with deck fields (spec 006, AC-6). Sets and categories come from the deck. */
const props = defineProps<{ cards: DeckCard[]; filter: DeckFilter }>()
const emit = defineEmits<{ update: [patch: Partial<DeckFilter>]; clear: [] }>()

const MANA_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7+'].map((v) => ({ value: v, label: v }))
const sets = computed(() => {
  const seen = new Map<string, string>()
  for (const c of props.cards) seen.set(c.printing.set_code, c.printing.set_name)
  return [...seen].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))
})
const categories = computed(() => {
  const seen = new Map<string, string>()
  for (const c of props.cards) for (const name of c.categories) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
  return [...seen.values()].sort().map((name) => ({ value: name, label: name }))
})
const fields = computed(() => [
  { key: 'own', label: 'Ownership', options: Object.entries(OWN_STATES).map(([value, s]) => ({ value, label: s.label })) },
  { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: t })) },
  { key: 'mv', label: 'Mana value', options: MANA_VALUES },
  { key: 'rarity', label: 'Rarity', options: RARITIES },
  ...(categories.value.length ? [{ key: 'category', label: 'Category', options: categories.value }] : []),
  { key: 'set', label: 'Set', options: sets.value },
] as { key: ListKey; label: string; options: { value: string; label: string }[] }[])
</script>

<template>
  <FilterShell :active-count="activeCount(filter)" @clear="emit('clear')">
    <ColorToggles :selected="filter.color" @change="(v) => emit('update', { color: v })" />
    <template v-for="f in fields" :key="f.key">
      <Separator />
      <CheckGroup
        :label="f.label" :options="f.options" :selected="filter[f.key]" :columns="f.key === 'set' ? 1 : 2"
        @change="(v) => emit('update', { [f.key]: v })"
      />
    </template>
  </FilterShell>
</template>
