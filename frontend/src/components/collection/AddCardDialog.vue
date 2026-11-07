<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Finish } from '@/lib/cards'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import CardSearch from './CardSearch.vue'
import ItemFields, { type ItemForm } from './ItemFields.vue'
import PrintingPicker from './PrintingPicker.vue'

type PickedCard = { oracle_id: string; name: string }

const props = defineProps<{
  /** Location to preselect: an id, null for Unfiled, undefined for none (the user must pick). */
  defaultLocation: number | null | undefined
  /** Add copies of this card, skipping the search (spec 005, AC-4). */
  card?: PickedCard | null
  /** Printing to preselect with `card`. */
  printingId?: string | null
  /** An empty binder pocket: one new copy goes there (spec 007, AC-14). */
  pocket?: { page: number; row: number; col: number } | null
  /** Start with this many copies and finish: Add to collection from the want list (spec 010, AC-12). */
  quantity?: number
  finish?: Finish | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const query = ref('')
const card = ref<PickedCard | null>(null)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const form = ref<ItemForm>(blankForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const search = ref<InstanceType<typeof CardSearch> | null>(null)

const fixed = computed(() => !!props.card)
const printing = computed(() => printings.value.find((p) => p.id === printingId.value) ?? null)
const currency = computed(() => auth.user?.currency ?? 'USD')

function blankForm(): ItemForm {
  const location = props.defaultLocation
  return {
    quantity: props.quantity ?? 1, finish: props.finish ?? 'nonfoil', condition: 'NM', language: 'en', purchase_price: '',
    purchase_currency: auth.user?.currency ?? 'USD',
    location: location === undefined ? '' : location === null ? 'unfiled' : String(location),
  }
}

function reset() {
  query.value = ''
  card.value = null
  printings.value = []
  printingId.value = null
  errors.value = {}
  form.value = blankForm()
}

watch(open, (isOpen) => {
  if (!isOpen) return
  reset()
  if (!locations.loaded) locations.load()
  if (props.card) void choose(props.card, props.printingId)
})
// Typing a new search drops the chosen card.
watch(query, () => !fixed.value && (card.value = null))

async function choose(result: PickedCard, preselect?: string | null) {
  card.value = result
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  printings.value = data ?? []
  printingId.value = printings.value.find((p) => p.id === preselect)?.id ?? printings.value[0]?.id ?? null
}

watch(printing, (p) => {
  if (p && !p.finishes.includes(form.value.finish)) form.value.finish = (p.finishes[0] ?? 'nonfoil') as Finish
})

async function add() {
  if (!printing.value) return
  const f = form.value
  if (f.location === '') return (errors.value = { location: 'Choose a location.' })
  saving.value = true
  errors.value = {}
  const { data, error } = await api.POST('/api/items/', {
    body: {
      printing: printing.value.id,
      quantity: f.quantity,
      finish: f.finish,
      condition: f.condition,
      language: f.language,
      purchase_price: f.purchase_price === '' ? null : Number(f.purchase_price),
      purchase_currency: f.purchase_price === '' ? null : f.purchase_currency,
      location: f.location === 'unfiled' ? null : Number(f.location),
      ...(props.pocket && f.location === String(props.defaultLocation) ? { slot: props.pocket } : {}),
    },
  })
  saving.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success(`Added ${f.quantity} × ${data.item.printing.name}${data.merged ? ' (merged with an existing row)' : ''}.`)
  emit('added')
  if (fixed.value || props.pocket) return (open.value = false)
  const keepLocation = f.location
  reset()
  form.value.location = keepLocation
  await nextTick()
  search.value?.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ fixed ? `Add ${card?.name ?? ''}` : pocket ? `Add card to page ${pocket.page}, row ${pocket.row}, column ${pocket.col}` : 'Add card' }}</DialogTitle>
      </DialogHeader>

      <CardSearch v-if="!fixed" ref="search" v-model:query="query" :picked="!!card" @choose="choose" />

      <template v-if="card">
        <div v-if="!fixed" class="flex items-center gap-2">
          <IconButton label="Back to results" variant="ghost" class="size-7" @click="card = null"><ArrowLeftIcon /></IconButton>
          <span class="font-medium">{{ card.name }}</span>
        </div>
        <PrintingPicker v-model="printingId" :printings="printings" />
        <p v-if="printing" class="text-sm text-muted-foreground" data-testid="printing-summary">
          {{ printing.set_name }} #{{ printing.collector_number }} ·
          <Price :value="printing.prices[form.finish]" :values="printing.prices_all[form.finish]" :currency="currency" />
        </p>
        <ItemFields v-if="printing" v-model="form" :finishes="printing.finishes" :errors="errors" />
      </template>

      <DialogFooter>
        <Button :disabled="!printing || saving" @click="add">Add</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
