<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import ExpandButton from '@/components/ExpandButton.vue'
import Price from '@/components/Price.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePreference } from '@/composables/usePreference'
import type { Finish } from '@/lib/cards'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

// Card printings, or a token's (spec 021, AC-10): only the fields shown here.
type Printing = Pick<Schemas['Printing'], 'id' | 'name' | 'set_code' | 'set_name' | 'collector_number' | 'finishes' | 'image_small' | 'image_normal' | 'image_large' | 'prices' | 'prices_all'> & { image_back_normal?: string }
type FinishFilter = 'all' | Finish

const props = defineProps<{
  printings: Printing[]
  /** Set the Finish field from the remembered filter when the picker opens (adding, not editing). */
  syncFinish?: boolean
}>()
const selected = defineModel<string | null>({ required: true })
/** The finish filter picked Non-foil, Foil or Etched: the copies' finish follows (spec 011, AC-8). */
const emit = defineEmits<{ finish: [finish: Finish] }>()
const currency = computed(() => useAuthStore().user?.currency ?? 'USD')

const FILTERS: { value: FinishFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'nonfoil', label: 'Non-foil' }, { value: 'foil', label: 'Foil' }, { value: 'etched', label: 'Etched' },
]
const SORTS = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
  { value: 'cheapest', label: 'Cheapest' }, { value: 'priciest', label: 'Priciest' },
] as const
// Both remembered in this browser (AC-9).
const filter = usePreference<FinishFilter>('printings.finish', 'all', ['all', 'nonfoil', 'foil', 'etched'])
const sort = usePreference('printings.sort', 'newest', SORTS.map((s) => s.value))

/** The finish a printing is priced in: the filter's, else non-foil, else its only one (AC-8). */
const finishOf = (p: Printing): Finish =>
  filter.value !== 'all' ? filter.value : p.finishes.includes('nonfoil') ? 'nonfoil' : ((p.finishes[0] ?? 'nonfoil') as Finish)
const priceOf = (p: Printing) => p.prices[finishOf(p)] ?? null

// Printings arrive newest first. No price sorts last either way (AC-7).
const shown = computed(() => {
  const list = props.printings.filter((p) => filter.value === 'all' || p.finishes.includes(filter.value))
  if (sort.value === 'oldest') return [...list].reverse()
  if (sort.value === 'cheapest' || sort.value === 'priciest') {
    const sign = sort.value === 'cheapest' ? 1 : -1
    return [...list].sort((a, b) => {
      const [pa, pb] = [priceOf(a), priceOf(b)]
      if (pa === null || pb === null) return pa === null ? (pb === null ? 0 : 1) : -1
      return (pa - pb) * sign
    })
  }
  return list
})

// A printing hidden by the filter can't stay picked: take the first one shown (AC-6).
watch(shown, (list) => {
  if (list.length && !list.some((p) => p.id === selected.value)) selected.value = list[0]!.id
})
watch(filter, (f) => f !== 'all' && emit('finish', f))
onMounted(() => props.syncFinish && filter.value !== 'all' && emit('finish', filter.value))
</script>

<!-- Printings of one card as images with prices; filter by finish and sort (spec 001 AC-22, spec 002 AC-18a, spec 011 AC-6 to AC-9). -->
<template>
  <div class="grid gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single" variant="outline" size="sm" :model-value="filter" aria-label="Filter printings"
        @update:model-value="(v) => v && (filter = v as FinishFilter)"
      >
        <ToggleGroupItem v-for="f in FILTERS" :key="f.value" :value="f.value" class="px-3">{{ f.label }}</ToggleGroupItem>
      </ToggleGroup>
      <Select v-model="sort">
        <SelectTrigger size="sm" class="w-32" aria-label="Sort printings"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div role="radiogroup" aria-label="Printing" class="flex gap-3 overflow-x-auto pb-2" data-testid="printing-picker">
      <div v-for="p in shown" :key="p.id" class="group relative shrink-0">
      <CardPreview :image="p.image_normal" :back="p.image_back_normal" :name="p.name">
      <button
        type="button" role="radio" :aria-checked="selected === p.id"
        :aria-label="`${p.set_name} #${p.collector_number}`"
        class="w-24 shrink-0 text-left"
        @click="selected = p.id"
      >
        <img
          :src="p.image_small" :alt="p.name" loading="lazy"
          :class="cn('aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted',
                     selected === p.id ? 'ring-2 ring-primary ring-offset-2' : 'opacity-80 hover:opacity-100')"
        />
        <span class="mt-1 block truncate text-xs uppercase">{{ p.set_code }} #{{ p.collector_number }}</span>
        <span class="block text-xs text-muted-foreground" data-testid="printing-price">
          <Price :value="priceOf(p)" :values="p.prices_all[finishOf(p)]" :currency="currency" />
        </span>
      </button>
      </CardPreview>
      <ExpandButton :image="p.image_large || p.image_normal" :name="`${p.name} (${p.set_name})`" />
      </div>
      <p v-if="!shown.length" class="py-6 text-sm text-muted-foreground">No printings with this finish.</p>
    </div>
  </div>
</template>
