<script setup lang="ts">
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoney, PLN_ESTIMATE, type Money } from '@/lib/money'

/**
 * A price in the viewer's currency; the other currencies show in a tooltip
 * (spec 002, AC-1 to AC-3).
 */
const props = defineProps<{ value: number | null | undefined; currency: string; values?: Money | null }>()

const others = computed(() =>
  props.values ? (Object.keys(props.values) as (keyof Money)[]).filter((c) => c !== props.currency) : [],
)
</script>

<template>
  <Tooltip v-if="values">
    <TooltipTrigger as-child>
      <span tabindex="0" class="cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-4" data-testid="price">
        {{ formatMoney(value, currency) }}
      </span>
    </TooltipTrigger>
    <TooltipContent class="grid gap-1" data-testid="price-tooltip">
      <span v-for="c in others" :key="c">{{ formatMoney(values[c], c) }}</span>
      <span class="max-w-56 text-pretty opacity-80">{{ PLN_ESTIMATE }}</span>
    </TooltipContent>
  </Tooltip>
  <span v-else data-testid="price">{{ formatMoney(value, currency) }}</span>
</template>
