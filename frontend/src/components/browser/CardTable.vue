<script setup lang="ts">
import Price from '@/components/Price.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf } from '@/lib/cards'
import CardMenu from './CardMenu.vue'
import type { BrowserRow } from './types'

defineProps<{
  rows: BrowserRow[]
  currency: string
  editable: boolean
  selecting: boolean
  isSelected: (id: number) => boolean
  showLocation: boolean
  selectAllState?: boolean | 'indeterminate'
}>()
const emit = defineEmits<{
  click: [row: BrowserRow, index: number, event: MouseEvent]
  check: [row: BrowserRow, index: number, event: MouseEvent]
  open: [row: BrowserRow]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  selectAll: []
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-md border" data-testid="card-table">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="editable" class="w-8">
            <Checkbox :model-value="selectAllState ?? false" aria-label="Select all" data-testid="select-all-header" @click.prevent="emit('selectAll')" />
          </TableHead>
          <TableHead class="w-12"><span class="sr-only">Image</span></TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Set</TableHead>
          <TableHead>#</TableHead>
          <TableHead>Finish</TableHead>
          <TableHead>Condition</TableHead>
          <TableHead>Language</TableHead>
          <TableHead class="text-right">Qty</TableHead>
          <TableHead class="text-right">Price</TableHead>
          <TableHead v-if="showLocation">Location</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <CardMenu
          v-for="(row, index) in rows" :key="row.id" :editable="editable"
          @open="emit('open', row)" @edit="emit('edit', row)" @delete="emit('delete', row)"
        >
          <TableRow
            class="cursor-pointer" :data-state="selecting && isSelected(row.id) ? 'selected' : undefined"
            data-testid="card-row"
            @click="emit('click', row, index, $event)"
          >
            <TableCell v-if="editable" @click.stop>
              <Checkbox
                :model-value="isSelected(row.id)" :aria-label="`Select ${row.printing.name}`"
                data-testid="card-checkbox" @click.prevent="emit('check', row, index, $event)"
              />
            </TableCell>
            <TableCell><img :src="row.printing.image_small" alt="" loading="lazy" class="h-10 rounded-sm" /></TableCell>
            <TableCell class="font-medium">{{ row.printing.name }}</TableCell>
            <TableCell :title="row.printing.set_name" class="uppercase">{{ row.printing.set_code }}</TableCell>
            <TableCell>{{ row.printing.collector_number }}</TableCell>
            <TableCell>{{ labelOf(FINISHES, row.finish) }}</TableCell>
            <TableCell>{{ labelOf(CONDITIONS, row.condition) }}</TableCell>
            <TableCell>{{ labelOf(LANGUAGES, row.language) }}</TableCell>
            <TableCell class="text-right">{{ row.quantity }}</TableCell>
            <TableCell class="text-right whitespace-nowrap"><Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" /></TableCell>
            <TableCell v-if="showLocation">{{ row.location_name ?? 'Unfiled' }}</TableCell>
          </TableRow>
        </CardMenu>
      </TableBody>
    </Table>
  </div>
</template>
