<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Condition, Finish, Language } from '@/lib/cards'
import type { Currency } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import ItemFields, { type ItemForm } from './ItemFields.vue'
import PrintingPicker from './PrintingPicker.vue'

/** Edit a row (right-click → Edit, or Edit in the detail), including its printing (spec 002, AC-18, AC-18a). */
const props = defineProps<{ row: BrowserRow | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [item: BrowserRow] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const form = ref<ItemForm | null>(null)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const printing = computed(() => printings.value.find((p) => p.id === printingId.value) ?? null)
// Finish options follow the chosen printing.
const finishes = computed(() => printing.value?.finishes ?? props.row?.printing.finishes ?? [])
watch(printing, (p) => {
  if (p && form.value && !p.finishes.includes(form.value.finish)) form.value.finish = (p.finishes[0] ?? 'nonfoil') as Finish
})
const errors = ref<Record<string, string>>({})
const busy = ref(false)

watch(open, async (isOpen) => {
  const row = props.row
  if (!isOpen || !row) return
  printingId.value = row.printing.id
  printings.value = []
  if (!locations.loaded) locations.load()
  errors.value = {}
  form.value = {
    quantity: row.quantity,
    finish: row.finish as Finish,
    condition: row.condition as Condition,
    language: row.language as Language,
    purchase_price: row.purchase_price == null ? '' : String(row.purchase_price),
    purchase_currency: (row.purchase_currency ?? auth.user?.currency ?? 'USD') as Currency,
    location: row.location == null ? 'unfiled' : String(row.location),
  }
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: row.printing.oracle_id } } })
  printings.value = data ?? []
})

async function save() {
  if (!props.row || !form.value) return
  busy.value = true
  const f = form.value
  const { data, error } = await api.PATCH('/api/items/{id}/', {
    params: { path: { id: props.row.id } },
    body: {
      printing: printingId.value ?? undefined,
      quantity: f.quantity,
      finish: f.finish,
      condition: f.condition,
      language: f.language,
      purchase_price: f.purchase_price === '' ? null : Number(f.purchase_price),
      purchase_currency: f.purchase_price === '' ? null : f.purchase_currency,
      // Cart rows keep no location here: a location would move them out of the cart.
      ...(props.row.in_cart ? {} : { location: f.location === 'unfiled' ? null : Number(f.location) }),
    },
  })
  busy.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success(data.merged ? 'Saved. It matched another row, so the two merged.' : 'Saved.')
  open.value = false
  emit('saved', data.item)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="row && form" class="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="edit-dialog">
      <DialogHeader>
        <DialogTitle>Edit {{ row.printing.name }}</DialogTitle>
        <DialogDescription>{{ row.printing.set_name }} #{{ row.printing.collector_number }}</DialogDescription>
      </DialogHeader>
      <PrintingPicker v-if="printings.length > 1" v-model="printingId" :printings="printings" @finish="(f) => form && (form.finish = f)" />
      <ItemFields v-model="form" :finishes="finishes" :errors="errors" :hide-location="!!row.in_cart" />
      <p v-if="errors.printing" class="text-sm text-destructive">{{ errors.printing }}</p>
      <DialogFooter>
        <Button :disabled="busy" @click="save">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
