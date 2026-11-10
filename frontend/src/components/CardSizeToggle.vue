<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CardSize } from '@/lib/cards'

/** S, M and L card sizes for grids and the binder (spec 002 add card, spec 006 AC-1, spec 023 AC-7). */
const size = defineModel<CardSize>({ required: true })
</script>

<template>
  <ToggleGroup type="single" variant="outline" :model-value="size" aria-label="Card size" @update:model-value="(v) => v && (size = v as CardSize)">
    <ToggleGroupItem value="sm" aria-label="Small cards">S</ToggleGroupItem>
    <ToggleGroupItem value="md" aria-label="Medium cards">M</ToggleGroupItem>
    <ToggleGroupItem value="lg" aria-label="Large cards">L</ToggleGroupItem>
  </ToggleGroup>
</template>
