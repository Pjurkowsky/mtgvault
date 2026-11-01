<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Finish } from '@/lib/cards'
import { formatMoney } from '@/lib/money'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import ItemFields, { type ItemForm } from './ItemFields.vue'
import PrintingPicker from './PrintingPicker.vue'

/** Location to preselect: an id, or null for Unfiled (AC-24). */
const props = defineProps<{ defaultLocation: number | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const query = ref('')
const results = ref<Schemas['CardSearchResult'][]>([])
const searching = ref(false)
const card = ref<Schemas['CardSearchResult'] | null>(null)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const form = ref<ItemForm>(blankForm())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const searchInput = ref<InstanceType<typeof Input> | null>(null)

const printing = computed(() => printings.value.find((p) => p.id === printingId.value) ?? null)
const currency = computed(() => auth.user?.currency ?? 'USD')

function blankForm(): ItemForm {
  return {
    quantity: 1, finish: 'nonfoil', condition: 'NM', language: 'en', purchase_price: '',
    purchase_currency: auth.user?.currency ?? 'USD',
    location: props.defaultLocation === null ? 'unfiled' : String(props.defaultLocation),
  }
}

function reset() {
  query.value = ''
  results.value = []
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
})

// Search as the user types, from 2 characters (AC-21).
let timer: ReturnType<typeof setTimeout>
let searchId = 0
watch(query, (q) => {
  clearTimeout(timer)
  card.value = null
  if (q.trim().length < 2) return (results.value = [])
  timer = setTimeout(async () => {
    const mine = ++searchId
    searching.value = true
    const { data } = await api.GET('/api/catalog/cards/', { params: { query: { q } } })
    if (mine !== searchId) return
    searching.value = false
    results.value = data ?? []
  }, 200)
})

async function choose(result: Schemas['CardSearchResult']) {
  card.value = result
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  printings.value = data ?? []
  printingId.value = printings.value[0]?.id ?? null // newest first (AC-22)
}

// Keep the finish valid for the chosen printing; nonfoil when available (AC-23).
watch(printing, (p) => {
  if (p && !p.finishes.includes(form.value.finish)) form.value.finish = (p.finishes[0] ?? 'nonfoil') as Finish
})

async function add() {
  if (!printing.value) return
  saving.value = true
  errors.value = {}
  const f = form.value
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
    },
  })
  saving.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success(`Added ${f.quantity} × ${data.item.printing.name}${data.merged ? ' (merged with an existing row)' : ''}.`)
  emit('added')
  // Stay open for the next card, keeping the chosen location (AC-25).
  const keepLocation = f.location
  reset()
  form.value.location = keepLocation
  await nextTick()
  ;(searchInput.value?.$el as HTMLInputElement | undefined)?.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add card</DialogTitle>
      </DialogHeader>

      <Input ref="searchInput" v-model="query" placeholder="Card name" aria-label="Card name" autocomplete="off" autofocus />

      <ul v-if="!card && results.length" class="grid max-h-80 gap-1 overflow-y-auto" data-testid="card-results">
        <li v-for="r in results" :key="r.oracle_id">
          <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted" @click="choose(r)">
            <img :src="r.image_small" alt="" class="h-12 rounded-sm" loading="lazy" />
            <span>{{ r.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="!card && query.trim().length >= 2 && !searching" class="text-sm text-muted-foreground">No cards found.</p>

      <template v-if="card">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" class="size-7" aria-label="Back to results" @click="card = null">
            <ArrowLeftIcon />
          </Button>
          <span class="font-medium">{{ card.name }}</span>
        </div>
        <PrintingPicker v-model="printingId" :printings="printings" />
        <p v-if="printing" class="text-sm text-muted-foreground" data-testid="printing-summary">
          {{ printing.set_name }} #{{ printing.collector_number }} ·
          {{ formatMoney(printing.prices[form.finish], currency) }}
        </p>
        <ItemFields v-if="printing" v-model="form" :finishes="printing.finishes" :errors="errors" />
      </template>

      <DialogFooter>
        <Button :disabled="!printing || saving" @click="add">Add</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
