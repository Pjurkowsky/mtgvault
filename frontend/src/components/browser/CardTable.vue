<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf } from '@/lib/cards'
import { formatMoney } from '@/lib/money'
import type { BrowserRow } from './types'

defineProps<{
  rows: BrowserRow[]
  currency: string
  selecting: boolean
  isSelected: (id: number) => boolean
  showLocation: boolean
}>()
const emit = defineEmits<{ open: [row: BrowserRow, index: number, event: MouseEvent] }>()
</script>

<template>
  <div class="overflow-x-auto rounded-md border" data-testid="card-table">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="selecting" class="w-8"><span class="sr-only">Selected</span></TableHead>
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
        <TableRow
          v-for="(row, index) in rows" :key="row.id"
          class="cursor-pointer" :data-state="selecting && isSelected(row.id) ? 'selected' : undefined"
          data-testid="card-row"
          @click="emit('open', row, index, $event)"
        >
          <TableCell v-if="selecting"><Checkbox :model-value="isSelected(row.id)" :aria-label="`Select ${row.printing.name}`" class="pointer-events-none" /></TableCell>
          <TableCell><img :src="row.printing.image_small" alt="" loading="lazy" class="h-10 rounded-sm" /></TableCell>
          <TableCell class="font-medium">{{ row.printing.name }}</TableCell>
          <TableCell :title="row.printing.set_name" class="uppercase">{{ row.printing.set_code }}</TableCell>
          <TableCell>{{ row.printing.collector_number }}</TableCell>
          <TableCell>{{ labelOf(FINISHES, row.finish) }}</TableCell>
          <TableCell>{{ labelOf(CONDITIONS, row.condition) }}</TableCell>
          <TableCell>{{ labelOf(LANGUAGES, row.language) }}</TableCell>
          <TableCell class="text-right">{{ row.quantity }}</TableCell>
          <TableCell class="text-right whitespace-nowrap">{{ formatMoney(row.unit_price, currency) }}</TableCell>
          <TableCell v-if="showLocation">{{ row.location_name ?? 'Unfiled' }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
