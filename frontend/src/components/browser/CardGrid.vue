<script setup lang="ts">
import { CheckIcon } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import type { BrowserRow } from './types'

defineProps<{ rows: BrowserRow[]; currency: string; selecting: boolean; isSelected: (id: number) => boolean }>()
const emit = defineEmits<{ open: [row: BrowserRow, index: number, event: MouseEvent] }>()
</script>

<template>
  <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" data-testid="card-grid">
    <li v-for="(row, index) in rows" :key="row.id">
      <button
        type="button"
        class="group relative block w-full text-left"
        :aria-label="`${row.printing.name}, ${row.quantity}×`"
        :aria-pressed="selecting ? isSelected(row.id) : undefined"
        data-testid="card-tile"
        @click="emit('open', row, index, $event)"
      >
        <img
          :src="row.printing.image_normal || row.printing.image_small"
          :alt="row.printing.name"
          loading="lazy"
          :class="cn('aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted object-cover transition',
                     selecting && isSelected(row.id) && 'ring-4 ring-primary ring-offset-2')"
        />
        <span class="absolute top-2 left-2 rounded-md bg-background/90 px-1.5 text-sm font-semibold shadow" data-testid="card-quantity">
          ×{{ row.quantity }}
        </span>
        <span v-if="row.finish !== 'nonfoil'" class="absolute top-2 right-2 rounded-md bg-background/90 px-1.5 text-xs capitalize shadow">
          {{ row.finish }}
        </span>
        <span
          v-if="selecting"
          :class="cn('absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-full border-2 border-background shadow',
                     isSelected(row.id) ? 'bg-primary text-primary-foreground' : 'bg-background/80')"
        >
          <CheckIcon v-if="isSelected(row.id)" class="size-4" />
        </span>
      </button>
      <p class="mt-1 flex justify-between gap-2 text-sm">
        <span class="truncate">{{ row.printing.name }}</span>
        <span class="shrink-0 text-muted-foreground" data-testid="card-price">{{ formatMoney(row.unit_price, currency) }}</span>
      </p>
    </li>
  </ul>
</template>
