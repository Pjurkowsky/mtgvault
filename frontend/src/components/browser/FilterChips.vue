<script setup lang="ts">
import { computed } from 'vue'
import { XIcon } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BrowserFilter } from '@/composables/useBrowserQuery'
import { COLORS, CONDITIONS, FINISHES, RARITIES, labelOf } from '@/lib/cards'
import { formatMoney } from '@/lib/money'

const props = defineProps<{ filter: BrowserFilter; currency: string }>()
const emit = defineEmits<{ update: [patch: Record<string, string | string[] | undefined>]; clear: [] }>()

type Chip = { label: string; remove: () => void }
const LABELS: Record<string, readonly { value: string; label: string }[]> = {
  color: COLORS, rarity: RARITIES, finish: FINISHES, condition: CONDITIONS,
}

const chips = computed<Chip[]>(() => {
  const f = props.filter
  const result: Chip[] = []
  for (const key of ['color', 'type', 'rarity', 'set', 'finish', 'condition'] as const) {
    for (const value of f[key] ?? []) {
      const label = key === 'set' ? value.toUpperCase() : LABELS[key] ? labelOf(LABELS[key], value) : value
      result.push({ label, remove: () => emit('update', { [key]: f[key]!.filter((v) => v !== value) }) })
    }
  }
  if (f.price_min) result.push({ label: `≥ ${formatMoney(Number(f.price_min), props.currency)}`, remove: () => emit('update', { price_min: undefined }) })
  if (f.price_max) result.push({ label: `≤ ${formatMoney(Number(f.price_max), props.currency)}`, remove: () => emit('update', { price_max: undefined }) })
  return result
})
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-2" data-testid="filter-chips">
    <Badge v-for="chip in chips" :key="chip.label" variant="secondary" class="gap-1 pr-1">
      {{ chip.label }}
      <button type="button" class="rounded-sm p-0.5 hover:bg-muted-foreground/20" :aria-label="`Remove ${chip.label}`" @click="chip.remove">
        <XIcon class="size-3" />
      </button>
    </Badge>
    <Button variant="link" size="sm" class="h-auto px-1" @click="emit('clear')">Clear all</Button>
  </div>
</template>
