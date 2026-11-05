<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LayoutGridIcon, ListIcon, RowsIcon, SearchIcon } from '@lucide/vue'
import CardSizeToggle from '@/components/CardSizeToggle.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { CardSize } from '@/lib/cards'
import type { DeckFilter } from '@/lib/deckFilter'
import type { DeckCard, GroupBy, SortBy } from '@/lib/decks'
import DeckFilterPopover from './DeckFilterPopover.vue'

export type Layout = 'text' | 'list' | 'visual'
export type DeckOption = 'layout' | 'group' | 'order' | 'size'

/** Search, filters, grouping, sort, view and size for the Deck tab (spec 005 AC-6, spec 006 AC-5 to AC-9). */
const props = defineProps<{
  cards: DeckCard[]; filter: DeckFilter; groupBy: GroupBy; sortBy: SortBy; layout: Layout; size: CardSize
}>()
const emit = defineEmits<{ filter: [patch: Partial<DeckFilter>]; clear: []; option: [key: DeckOption, value: string] }>()

const search = ref<InstanceType<typeof Input> | null>(null)
const query = ref(props.filter.q)
watch(() => props.filter.q, (q) => q !== query.value && (query.value = q))
watch(query, (q) => emit('filter', { q }))

const inputEl = () => (search.value?.$el as HTMLInputElement | undefined)
function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const typing = target.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]')
  if (event.key === '/' && !typing) {
    event.preventDefault()
    inputEl()?.focus()
  }
}
function onSearchKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    query.value = ''
    inputEl()?.blur()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const KEYS = '/ focuses the search, Escape clears it. Arrow keys move between cards; Enter opens one.'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="deck-toolbar">
    <div class="relative w-full sm:w-60">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref="search" v-model="query" type="search" placeholder="Search cards" aria-label="Search deck" class="pl-8" @keydown="onSearchKey" />
    </div>
    <InfoTip :text="KEYS" />
    <DeckFilterPopover :cards="cards" :filter="filter" @update="(p) => emit('filter', p)" @clear="emit('clear')" />
    <Select :model-value="groupBy" @update:model-value="(v) => emit('option', 'group', String(v))">
      <SelectTrigger class="w-40" aria-label="Group by"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="type">By type</SelectItem>
        <SelectItem value="mana_value">By mana value</SelectItem>
        <SelectItem value="color">By color</SelectItem>
        <SelectItem value="category">By category</SelectItem>
      </SelectContent>
    </Select>
    <Select :model-value="sortBy" @update:model-value="(v) => emit('option', 'order', String(v))">
      <SelectTrigger class="w-36" aria-label="Sort by"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="name">Name</SelectItem>
        <SelectItem value="mana_value">Mana value</SelectItem>
        <SelectItem value="price">Price</SelectItem>
      </SelectContent>
    </Select>
    <div class="ml-auto flex gap-2">
      <CardSizeToggle v-if="layout === 'visual'" :model-value="size" @update:model-value="(v) => emit('option', 'size', v)" />
      <ToggleGroup type="single" variant="outline" :model-value="layout" @update:model-value="(v) => v && emit('option', 'layout', String(v))">
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="text" aria-label="Text"><RowsIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Text</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="list" aria-label="List"><ListIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>List</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="visual" aria-label="Card images"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Card images</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  </div>
</template>
