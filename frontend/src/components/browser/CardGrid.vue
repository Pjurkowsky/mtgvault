<script setup lang="ts">
import Price from '@/components/Price.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import CardMenu from './CardMenu.vue'
import type { BrowserRow } from './types'

const props = defineProps<{
  rows: BrowserRow[]
  currency: string
  /** Owner view: checkboxes, Edit and Delete. */
  editable: boolean
  selecting: boolean
  isSelected: (id: number) => boolean
}>()
const emit = defineEmits<{
  click: [row: BrowserRow, index: number, event: MouseEvent]
  check: [row: BrowserRow, index: number, event: MouseEvent]
  open: [row: BrowserRow]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
}>()

const selected = (row: BrowserRow) => props.selecting && props.isSelected(row.id)
</script>

<!-- Image-only tiles; name and price on hover (spec 002, AC-17). -->
<template>
  <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" data-testid="card-grid">
    <li v-for="(row, index) in rows" :key="row.id" class="group relative">
      <CardMenu :editable="editable" @open="emit('open', row)" @edit="emit('edit', row)" @delete="emit('delete', row)">
        <button
          type="button"
          class="relative block w-full overflow-hidden rounded-[4.75%/3.5%] text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :aria-label="`${row.printing.name}, ${row.quantity}×`"
          data-testid="card-tile"
          :data-selected="selected(row) || undefined"
          @click="emit('click', row, index, $event)"
        >
          <img
            :src="row.printing.image_normal || row.printing.image_small"
            :alt="row.printing.name"
            loading="lazy"
            :class="cn('aspect-[488/680] w-full bg-muted object-cover transition', selected(row) && 'scale-[0.94] rounded-[4.75%/3.5%]')"
          />
          <span class="absolute top-2 left-2 flex gap-1">
            <span class="rounded-md bg-background/90 px-1.5 text-sm font-semibold shadow" data-testid="card-quantity">×{{ row.quantity }}</span>
            <span v-if="row.finish !== 'nonfoil'" class="rounded-md bg-background/90 px-1.5 text-xs leading-5 capitalize shadow">{{ row.finish }}</span>
          </span>
          <span
            class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            data-testid="card-hover"
          >
            <span class="truncate font-medium">{{ row.printing.name }}</span>
            <Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" />
          </span>
        </button>
      </CardMenu>
      <Checkbox
        v-if="editable"
        :model-value="isSelected(row.id)"
        :aria-label="`Select ${row.printing.name}`"
        :class="cn('absolute top-2 right-2 size-5 border-2 bg-background/90 shadow transition-opacity',
                   selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')"
        data-testid="card-checkbox"
        @click.prevent="emit('check', row, index, $event)"
      />
    </li>
  </ul>
</template>
