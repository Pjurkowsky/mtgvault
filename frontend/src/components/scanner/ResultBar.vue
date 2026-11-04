<script setup lang="ts">
import { computed } from 'vue'
import { PlusIcon, RefreshCwIcon, Undo2Icon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FINISHES } from '@/lib/cards'

/**
 * The last logged card with quick fixes (spec 003, AC-11). A decklist-only scan
 * (spec 005, AC-17) has no collection row: just +1 and Undo.
 */
const props = defineProps<{ item?: Schemas['Item'] | null; deckCard?: Schemas['ScannedDeckCard'] | null; currency: string }>()
const emit = defineEmits<{ plus: []; undo: []; finish: [finish: Schemas['FinishEnum']]; printing: [] }>()
const printing = computed(() => (props.item ?? props.deckCard)!.printing)
const finishes = () => (props.item ? FINISHES.filter((f) => props.item!.printing.finishes.includes(f.value)) : [])
</script>

<template>
  <div class="flex items-center gap-3 rounded-xl bg-background/95 p-3 shadow-xl backdrop-blur" data-testid="result-bar">
    <img :src="printing.image_small" :alt="printing.name" class="h-24 w-[4.3rem] shrink-0 rounded-[4.75%/3.5%] bg-muted" />
    <div class="grid min-w-0 flex-1 gap-1.5">
      <div class="flex items-baseline gap-2">
        <span class="truncate font-medium" data-testid="result-name">{{ printing.name }}</span>
        <span class="shrink-0 text-sm text-muted-foreground" data-testid="result-quantity">×{{ (item ?? deckCard)!.quantity }}</span>
      </div>
      <span class="truncate text-sm text-muted-foreground">
        {{ printing.set_name }} #{{ printing.collector_number }} ·
        <Price v-if="item" :value="item.unit_price" :values="item.unit_prices" :currency="currency" />
        <Price v-else :value="deckCard!.price" :currency="currency" />
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <ToggleGroup
          v-if="item && finishes().length > 1" type="single" variant="outline" size="sm" :model-value="item.finish"
          aria-label="Finish" @update:model-value="(v) => v && emit('finish', v as Schemas['FinishEnum'])"
        >
          <ToggleGroupItem v-for="f in finishes()" :key="f.value" :value="f.value" class="px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{{ f.label }}</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" variant="outline" @click="emit('plus')"><PlusIcon /> 1</Button>
        <Button v-if="item" size="sm" variant="outline" @click="emit('printing')"><RefreshCwIcon /> Change printing</Button>
        <Button size="sm" variant="ghost" @click="emit('undo')"><Undo2Icon /> Undo</Button>
      </div>
    </div>
  </div>
</template>
