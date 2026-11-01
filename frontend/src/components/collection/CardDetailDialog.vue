<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf, type Condition, type Finish, type Language } from '@/lib/cards'
import type { Currency } from '@/lib/currency'
import { formatMoney } from '@/lib/money'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import ItemFields, { type ItemForm } from './ItemFields.vue'
import PrintingPicker from './PrintingPicker.vue'

const props = defineProps<{ row: BrowserRow | null; currency: string; readonly?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const form = ref<ItemForm | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const confirmingDelete = ref(false)

const shown = computed(() => printings.value.find((p) => p.id === printingId.value) ?? props.row?.printing ?? null)

watch(open, async (isOpen) => {
  const row = props.row
  if (!isOpen || !row) return
  errors.value = {}
  confirmingDelete.value = false
  printingId.value = row.printing.id
  printings.value = []
  if (props.readonly) return (form.value = null)
  if (!locations.loaded) locations.load()
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
      location: f.location === 'unfiled' ? null : Number(f.location),
    },
  })
  busy.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success(data.merged ? 'Saved. It matched another row, so the two merged.' : 'Saved.')
  open.value = false
  emit('changed')
}

async function remove() {
  if (!props.row) return
  busy.value = true
  const { error } = await api.DELETE('/api/items/{id}/', { params: { path: { id: props.row.id } } })
  busy.value = false
  if (error) return toast.error('Could not delete.')
  toast.success(`Deleted ${props.row.printing.name}.`)
  open.value = false
  emit('changed')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="row && shown" class="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="card-detail">
      <DialogHeader>
        <DialogTitle>{{ shown.name }}</DialogTitle>
        <DialogDescription>{{ shown.set_name }} #{{ shown.collector_number }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <img :src="shown.image_large || shown.image_normal" :alt="shown.name" class="w-full rounded-[4.75%/3.5%] bg-muted" />

        <div class="grid content-start gap-5">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Price</dt>
            <dd data-testid="detail-price">{{ formatMoney(row.unit_price, currency) }}</dd>
            <template v-if="!readonly">
              <dt class="text-muted-foreground">Price when added</dt>
              <dd data-testid="detail-added-price">{{ formatMoney(row.added_price, currency) }}</dd>
              <dt class="text-muted-foreground">Purchase price</dt>
              <dd data-testid="detail-purchase-price">
                {{ row.purchase_price == null ? '–' : formatMoney(row.purchase_price, row.purchase_currency ?? currency) }}
              </dd>
            </template>
            <template v-else>
              <dt class="text-muted-foreground">Quantity</dt><dd>{{ row.quantity }}</dd>
              <dt class="text-muted-foreground">Finish</dt><dd>{{ labelOf(FINISHES, row.finish) }}</dd>
              <dt class="text-muted-foreground">Condition</dt><dd>{{ labelOf(CONDITIONS, row.condition) }}</dd>
              <dt class="text-muted-foreground">Language</dt><dd>{{ labelOf(LANGUAGES, row.language) }}</dd>
            </template>
          </dl>

          <template v-if="!readonly && form">
            <PrintingPicker v-if="printings.length > 1" v-model="printingId" :printings="printings" />
            <ItemFields v-model="form" :finishes="shown.finishes" :errors="errors" />
            <p v-if="errors.form || errors.printing" class="text-sm text-destructive">{{ errors.form || errors.printing }}</p>
          </template>
        </div>
      </div>

      <DialogFooter v-if="!readonly" class="gap-2 sm:justify-between">
        <div class="flex gap-2">
          <Button v-if="!confirmingDelete" variant="ghost" class="text-destructive" @click="confirmingDelete = true">Delete</Button>
          <template v-else>
            <Button variant="destructive" :disabled="busy" @click="remove">Confirm delete</Button>
            <Button variant="ghost" @click="confirmingDelete = false">Keep</Button>
          </template>
        </div>
        <Button :disabled="busy" @click="save">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
