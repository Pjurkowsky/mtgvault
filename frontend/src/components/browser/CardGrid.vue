<script setup lang="ts">
import Price from '@/components/Price.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import CardMenu, { type MenuItem } from './CardMenu.vue'
import CardTile from './CardTile.vue'
import type { BrowserRow } from './types'

const props = defineProps<{
  rows: BrowserRow[]
  currency: string
  /** Owner view: checkboxes, Edit and Delete. */
  editable: boolean
  selecting: boolean
  isSelected: (id: number) => boolean
  /** Menu items; omit for the collection's (spec 010: the want list has its own). */
  menu?: MenuItem[]
  /** Checkboxes; defaults to `editable`. */
  selectable?: boolean
}>()
const emit = defineEmits<{
  click: [row: BrowserRow, index: number, event: MouseEvent]
  check: [row: BrowserRow, index: number, event: MouseEvent]
  open: [row: BrowserRow]
  deck: [row: BrowserRow]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  collect: [row: BrowserRow]
}>()

const selected = (row: BrowserRow) => props.selecting && props.isSelected(row.id)
const canSelect = () => props.selectable ?? props.editable
</script>

<!-- Image-only tiles; name and price on hover (spec 002, AC-17). -->
<template>
  <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8" data-testid="card-grid">
    <li v-for="(row, index) in rows" :key="row.id" class="group relative">
      <CardMenu :editable="editable" :items="menu" @open="emit('open', row)" @edit="emit('edit', row)" @delete="emit('delete', row)" @deck="emit('deck', row)" @collect="emit('collect', row)">
        <CardTile
          :image="row.printing.image_normal || row.printing.image_small" :name="row.printing.name" :quantity="row.quantity"
          :label="`${row.printing.name}, ${row.quantity}×`" :selected="selected(row)" @click="emit('click', row, index, $event)"
        >
          <template #badges>
            <span v-if="row.finish !== 'nonfoil'" class="rounded-md bg-background/90 px-1.5 text-xs leading-5 capitalize shadow">{{ row.finish }}</span>
          </template>
          <template #price><Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" /></template>
        </CardTile>
      </CardMenu>
      <Checkbox
        v-if="canSelect()"
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
