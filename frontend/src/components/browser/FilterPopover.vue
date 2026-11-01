<script setup lang="ts">
import { ref, watch } from 'vue'
import { SlidersHorizontalIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import type { BrowserFilter } from '@/composables/useBrowserQuery'
import { COLORS, CONDITIONS, FINISHES, RARITIES, TYPES } from '@/lib/cards'

const props = defineProps<{ filter: BrowserFilter; activeCount: number; currency: string }>()
const emit = defineEmits<{ update: [patch: Record<string, string | string[] | undefined>] }>()

type ListKey = 'color' | 'type' | 'rarity' | 'set' | 'finish' | 'condition'

const has = (key: ListKey, value: string) => props.filter[key]?.includes(value) ?? false
function toggle(key: ListKey, value: string, on: boolean) {
  const current = props.filter[key] ?? []
  emit('update', { [key]: on ? [...current, value] : current.filter((v) => v !== value) })
}

// Price range: apply on blur/Enter so typing doesn't reload on every key.
const priceMin = ref(props.filter.price_min ?? '')
const priceMax = ref(props.filter.price_max ?? '')
watch(() => [props.filter.price_min, props.filter.price_max], ([min, max]) => {
  priceMin.value = min ?? ''
  priceMax.value = max ?? ''
})
const applyPrice = () => emit('update', { price_min: String(priceMin.value) || undefined, price_max: String(priceMax.value) || undefined })

// Sets: search the catalog, pick several.
const setQuery = ref('')
const setResults = ref<Schemas['Set'][]>([])
let setTimer: ReturnType<typeof setTimeout>
watch(setQuery, (q) => {
  clearTimeout(setTimer)
  if (q.trim().length < 2) return (setResults.value = [])
  setTimer = setTimeout(async () => {
    const { data } = await api.GET('/api/catalog/sets/', { params: { query: { q } } })
    setResults.value = data ?? []
  }, 200)
})
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
      <section class="grid gap-2">
        <Label>Color</Label>
        <div class="flex flex-wrap gap-1">
          <Toggle
            v-for="c in COLORS" :key="c.value" size="sm" variant="outline"
            :model-value="has('color', c.value)" :aria-label="c.label"
            @update:model-value="(on: boolean) => toggle('color', c.value, on)"
          >{{ c.value }}</Toggle>
        </div>
      </section>
      <Separator />
      <section v-for="group in [
        { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: t })) },
        { key: 'rarity', label: 'Rarity', options: RARITIES },
        { key: 'finish', label: 'Finish', options: FINISHES },
        { key: 'condition', label: 'Condition', options: CONDITIONS },
      ] as const" :key="group.key" class="grid gap-2">
        <Label>{{ group.label }}</Label>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <label v-for="o in group.options" :key="o.value" class="flex items-center gap-2 text-sm">
            <Checkbox
              :model-value="has(group.key, o.value)"
              @update:model-value="(on) => toggle(group.key, o.value, on === true)"
            />
            {{ o.label }}
          </label>
        </div>
      </section>
      <Separator />
      <section class="grid gap-2">
        <Label for="set-search">Set</Label>
        <Input id="set-search" v-model="setQuery" placeholder="Search sets" autocomplete="off" />
        <div v-if="setResults.length" class="grid gap-1">
          <label v-for="s in setResults" :key="s.code" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="has('set', s.code)" @update:model-value="(on) => toggle('set', s.code, on === true)" />
            <span class="truncate">{{ s.name }}</span>
            <span class="text-muted-foreground uppercase">{{ s.code }}</span>
          </label>
        </div>
      </section>
      <Separator />
      <section class="grid gap-2">
        <Label>Price ({{ currency }})</Label>
        <div class="flex items-center gap-2">
          <Input v-model="priceMin" type="number" min="0" step="0.01" placeholder="Min" aria-label="Minimum price" @blur="applyPrice" @keydown.enter="applyPrice" />
          <span class="text-muted-foreground">–</span>
          <Input v-model="priceMax" type="number" min="0" step="0.01" placeholder="Max" aria-label="Maximum price" @blur="applyPrice" @keydown.enter="applyPrice" />
        </div>
      </section>
    </PopoverContent>
  </Popover>
</template>
