<script setup lang="ts">
import type { Schemas } from '@/api/client'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import type { WantRow } from '@/components/browser/types'
import { FINISHES, labelOf } from '@/lib/cards'

/** A want list entry in the card dialog (spec 010, AC-10). Read-only on a public want list. */
defineProps<{ want: WantRow | Schemas['PublicWant']; currency: string; readonly?: boolean }>()
const emit = defineEmits<{ edit: []; collect: []; delete: [] }>()
const deckName = (w: WantRow | Schemas['PublicWant']) => ('deck_name' in w ? w.deck_name : null)
</script>

<template>
  <section class="grid gap-4" data-testid="want-entry">
    <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      <div><dt class="text-muted-foreground">Wanted</dt><dd data-testid="want-quantity">{{ want.quantity }}</dd></div>
      <div>
        <dt class="text-muted-foreground">Printing</dt>
        <dd data-testid="want-printing">{{ want.any_printing ? 'Any' : `${want.printing.set_code.toUpperCase()} #${want.printing.collector_number}` }}</dd>
      </div>
      <div><dt class="text-muted-foreground">Finish</dt><dd data-testid="want-finish">{{ want.finish === 'any' ? 'Any' : labelOf(FINISHES, want.finish) }}</dd></div>
      <div v-if="!readonly"><dt class="text-muted-foreground">Deck</dt><dd data-testid="want-deck">{{ deckName(want) ?? 'None' }}</dd></div>
      <div><dt class="text-muted-foreground">Price</dt><dd><Price :value="want.unit_price" :values="want.unit_prices" :currency="currency" /></dd></div>
    </dl>
    <div v-if="!readonly" class="flex flex-wrap gap-2">
      <Button variant="outline" @click="emit('edit')">Edit</Button>
      <Button @click="emit('collect')">Add to collection</Button>
      <Button variant="outline" class="text-destructive" @click="emit('delete')">Delete</Button>
    </div>
  </section>
</template>
