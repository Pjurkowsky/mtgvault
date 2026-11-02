<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Condition, Finish, Language } from '@/lib/cards'
import type { Currency } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import ItemFields, { type ItemForm } from './ItemFields.vue'

/** Edit a row's fields (right-click → Edit, or Edit in the detail). Printing changes live in the detail's reprints. */
const props = defineProps<{ row: BrowserRow | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [item: BrowserRow] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const form = ref<ItemForm | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)

watch(open, (isOpen) => {
  const row = props.row
  if (!isOpen || !row) return
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
})

async function save() {
  if (!props.row || !form.value) return
  busy.value = true
  const f = form.value
  const { data, error } = await api.PATCH('/api/items/{id}/', {
    params: { path: { id: props.row.id } },
    body: {
      quantity: f.quantity,
      finish: f.finish,
      condition: f.condition,
      language: f.language,
      purchase_price: f.purchase_price === '' ? null : Number(f.purchase_price),
      purchase_currency: f.purchase_price === '' ? null : f.purchase_currency,
      location: f.location === 'unfiled' ? null : Number(f.location),
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
    <DialogContent v-if="row && form" class="sm:max-w-2xl" data-testid="edit-dialog">
      <DialogHeader>
        <DialogTitle>Edit {{ row.printing.name }}</DialogTitle>
        <DialogDescription>{{ row.printing.set_name }} #{{ row.printing.collector_number }}</DialogDescription>
      </DialogHeader>
      <ItemFields v-model="form" :finishes="row.printing.finishes" :errors="errors" />
      <DialogFooter>
        <Button :disabled="busy" @click="save">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
