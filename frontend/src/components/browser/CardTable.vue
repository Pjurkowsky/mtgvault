<script setup lang="ts">
import CardPreview from '@/components/CardPreview.vue'
import Price from '@/components/Price.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf } from '@/lib/cards'
import CardMenu, { type MenuItem } from './CardMenu.vue'
import type { BrowserRow } from './types'

const props = defineProps<{
  rows: BrowserRow[]
  currency: string
  editable: boolean
  selecting: boolean
  isSelected: (id: number) => boolean
  /** Menu items; omit for the collection's (spec 010: the want list has its own). */
  menu?: MenuItem[]
  /** Checkboxes; defaults to `editable`. */
  selectable?: boolean
  showLocation: boolean
  selectAllState?: boolean | 'indeterminate'
  /** Want list columns: Printing, Finish and Deck instead of set, condition and language (spec 010, AC-8). */
  wants?: boolean
}>()
const emit = defineEmits<{
  click: [row: BrowserRow, index: number, event: MouseEvent]
  check: [row: BrowserRow, index: number, event: MouseEvent]
  open: [row: BrowserRow]
  deck: [row: BrowserRow]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  collect: [row: BrowserRow]
  selectAll: []
}>()
const canSelect = () => props.selectable ?? props.editable
const finishLabel = (row: BrowserRow) => (row.want?.finish === 'any' ? 'Any' : labelOf(FINISHES, row.finish))
const printingLabel = (row: BrowserRow) =>
  row.want?.any_printing ? 'Any' : `${row.printing.set_code.toUpperCase()} #${row.printing.collector_number}`
const deckLabel = (row: BrowserRow) => (row.want && 'deck_name' in row.want ? row.want.deck_name ?? '' : '')
</script>

<template>
  <div class="overflow-x-auto rounded-md border" data-testid="card-table">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="canSelect()" class="w-8">
            <Checkbox :model-value="selectAllState ?? false" aria-label="Select all" data-testid="select-all-header" @click.prevent="emit('selectAll')" />
          </TableHead>
          <TableHead class="w-12"><span class="sr-only">Image</span></TableHead>
          <TableHead>Name</TableHead>
          <template v-if="wants">
            <TableHead>Printing</TableHead>
            <TableHead>Finish</TableHead>
          </template>
          <template v-else>
            <TableHead>Set</TableHead>
            <TableHead>#</TableHead>
            <TableHead>Finish</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Language</TableHead>
          </template>
          <TableHead class="text-right">Qty</TableHead>
          <TableHead class="text-right">Price</TableHead>
          <TableHead v-if="showLocation">Location</TableHead>
          <TableHead v-if="wants && editable">Deck</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <CardMenu
          v-for="(row, index) in rows" :key="row.id" :editable="editable" :items="menu"
          @open="emit('open', row)" @edit="emit('edit', row)" @delete="emit('delete', row)" @deck="emit('deck', row)" @collect="emit('collect', row)"
        >
          <TableRow
            class="cursor-pointer" :data-state="selecting && isSelected(row.id) ? 'selected' : undefined"
            data-testid="card-row"
            @click="emit('click', row, index, $event)"
          >
            <TableCell v-if="canSelect()" @click.stop>
              <Checkbox
                :model-value="isSelected(row.id)" :aria-label="`Select ${row.printing.name}`"
                data-testid="card-checkbox" @click.prevent="emit('check', row, index, $event)"
              />
            </TableCell>
            <!-- The thumbnail is small: hovering it or the name shows the card (spec 006, AC-2). -->
            <TableCell>
              <CardPreview :image="row.printing.image_normal" :name="row.printing.name">
                <img :src="row.printing.image_small" alt="" loading="lazy" class="h-10 rounded-sm" />
              </CardPreview>
            </TableCell>
            <TableCell class="font-medium">
              <CardPreview :image="row.printing.image_normal" :name="row.printing.name"><span>{{ row.printing.name }}</span></CardPreview>
            </TableCell>
            <template v-if="wants">
              <TableCell :title="row.printing.set_name" data-testid="want-printing">{{ printingLabel(row) }}</TableCell>
              <TableCell>{{ finishLabel(row) }}</TableCell>
            </template>
            <template v-else>
              <TableCell :title="row.printing.set_name" class="uppercase">{{ row.printing.set_code }}</TableCell>
              <TableCell>{{ row.printing.collector_number }}</TableCell>
              <TableCell>{{ labelOf(FINISHES, row.finish) }}</TableCell>
              <TableCell>{{ labelOf(CONDITIONS, row.condition) }}</TableCell>
              <TableCell>{{ labelOf(LANGUAGES, row.language) }}</TableCell>
            </template>
            <TableCell class="text-right">{{ row.quantity }}</TableCell>
            <TableCell class="text-right whitespace-nowrap"><Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" /></TableCell>
            <TableCell v-if="showLocation">{{ row.location_name ?? 'Unfiled' }}</TableCell>
            <TableCell v-if="wants && editable" data-testid="want-deck">{{ deckLabel(row) }}</TableCell>
          </TableRow>
        </CardMenu>
      </TableBody>
    </Table>
  </div>
</template>
