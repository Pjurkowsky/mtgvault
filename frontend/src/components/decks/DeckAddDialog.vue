<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardSearch from '@/components/collection/CardSearch.vue'
import ItemFields, { type ItemForm } from '@/components/collection/ItemFields.vue'
import PrintingPicker from '@/components/collection/PrintingPicker.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Finish } from '@/lib/cards'
import { ZONE_LABELS, zonesForCard, type DeckDetail, type Zone } from '@/lib/decks'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'

/**
 * Add to a deck: the collection's search, then printing, quantity and zone, and
 * optionally copies for the collection (spec 005, AC-1, AC-2). Stays open for the next card.
 */
type PickedCard = { oracle_id: string; name: string }
const props = defineProps<{
  deck: DeckDetail
  /** Add this card, skipping the search: Add from the card dialog (spec 010, AC-2). */
  card?: PickedCard | null
  printingId?: string | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const auth = useAuthStore()
const locations = useLocationsStore()
const ACTIVE = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

const query = ref('')
const card = ref<PickedCard | null>(null)
const fixed = computed(() => !!props.card)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const quantity = ref(1)
const zone = ref<Zone>('main')
const alsoOwn = ref(false)
const form = ref<ItemForm>(blankForm())
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const search = ref<InstanceType<typeof CardSearch> | null>(null)

const printing = computed(() => printings.value.find((p) => p.id === printingId.value) ?? null)
const zones = computed(() => zonesForCard(props.deck.format, printing.value))
const currency = computed(() => auth.user?.currency ?? 'USD')

/** Copies start in the deck box; without one the user picks (AC-2). */
function blankForm(): ItemForm {
  return {
    quantity: 1, finish: 'nonfoil', condition: 'NM', language: 'en', purchase_price: '',
    purchase_currency: auth.user?.currency ?? 'USD', location: props.deck.location ? String(props.deck.location) : '',
  }
}

function reset() {
  query.value = ''
  card.value = null
  quantity.value = 1
  errors.value = {}
}

watch(open, (isOpen) => {
  if (!isOpen) return
  reset()
  zone.value = 'main'
  alsoOwn.value = false
  form.value = blankForm()
  if (!locations.loaded) locations.load()
  if (props.card) void choose(props.card, props.printingId)
})
watch(query, () => !fixed.value && (card.value = null))
watch(zones, (list) => !list.includes(zone.value) && (zone.value = 'main'))
watch(printing, (p) => {
  if (p && !p.finishes.includes(form.value.finish)) form.value.finish = (p.finishes[0] ?? 'nonfoil') as Finish
})

async function choose(result: PickedCard, preselect?: string | null) {
  card.value = result
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  printings.value = data ?? []
  printingId.value = printings.value.find((p) => p.id === preselect)?.id ?? printings.value[0]?.id ?? null
}

async function add() {
  if (!printing.value || !card.value) return
  const f = form.value
  if (alsoOwn.value && f.location === '') return (errors.value = { location: 'Choose a location.' })
  busy.value = true
  errors.value = {}
  // The decklist first: copies landing in the deck box then find the card already listed (spec 004, AC-29).
  const added = await api.POST('/api/decks/{id}/cards/', {
    params: { path: { id: props.deck.id } },
    body: { printing: printing.value.id, quantity: quantity.value, zone: zone.value },
  })
  if (!added.data) {
    busy.value = false
    return (errors.value = fieldErrors(added.error as unknown))
  }
  let deck = added.data
  if (alsoOwn.value) {
    const owned = await api.POST('/api/items/', {
      body: {
        printing: printing.value.id, quantity: quantity.value, finish: f.finish, condition: f.condition, language: f.language,
        purchase_price: f.purchase_price === '' ? null : Number(f.purchase_price),
        purchase_currency: f.purchase_price === '' ? null : f.purchase_currency,
        location: f.location === 'unfiled' ? null : Number(f.location),
      },
    })
    if (!owned.data) toast.error(Object.values(fieldErrors(owned.error as unknown)).join(' ') || 'Could not add the copies.')
    const fresh = await api.GET('/api/decks/{id}/', { params: { path: { id: props.deck.id } } })
    deck = fresh.data ?? deck
    void locations.load()
  }
  busy.value = false
  toast.success(`Added ${quantity.value} × ${card.value.name} to ${ZONE_LABELS[zone.value]}${alsoOwn.value ? ' and your collection' : ''}.`)
  emit('changed', deck)
  if (fixed.value) return (open.value = false)
  reset()
  await nextTick()
  search.value?.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{{ fixed && card ? `Add ${card.name} to ${deck.name}` : `Add to ${deck.name}` }}</DialogTitle></DialogHeader>
      <CardSearch v-if="!fixed" ref="search" v-model:query="query" :picked="!!card" @choose="choose" />

      <template v-if="card">
        <div v-if="!fixed" class="flex items-center gap-2">
          <IconButton label="Back to results" variant="ghost" class="size-7" @click="card = null"><ArrowLeftIcon /></IconButton>
          <span class="font-medium">{{ card.name }}</span>
        </div>
        <PrintingPicker v-model="printingId" :printings="printings" sync-finish @finish="(f) => (form.finish = f)" />
        <p v-if="printing" class="text-sm text-muted-foreground" data-testid="printing-summary">
          {{ printing.set_name }} #{{ printing.collector_number }} ·
          <Price :value="printing.prices[form.finish]" :values="printing.prices_all[form.finish]" :currency="currency" />
        </p>
        <div class="grid grid-cols-[6rem_1fr] items-center gap-3">
          <Label for="deck-add-qty">Quantity</Label>
          <Input id="deck-add-qty" v-model.number="quantity" type="number" min="1" max="999" class="w-24" />
          <Label id="deck-add-zone">Zone</Label>
          <ToggleGroup type="single" variant="outline" :model-value="zone" aria-labelledby="deck-add-zone" class="flex-wrap justify-start" @update:model-value="(v) => v && (zone = v as Zone)">
            <ToggleGroupItem v-for="z in zones" :key="z" :value="z" :class="ACTIVE" class="px-3">{{ ZONE_LABELS[z] }}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <label class="flex w-fit items-center gap-2 text-sm">
          <Checkbox v-model="alsoOwn" /> Also add to my collection
        </label>
        <ItemFields v-if="alsoOwn && printing" v-model="form" :finishes="printing.finishes" :errors="errors" hide-quantity />
        <p v-if="errors.zone || errors.printing" class="text-sm text-destructive">{{ errors.zone ?? errors.printing }}</p>
      </template>

      <DialogFooter>
        <Button :disabled="!printing || busy" @click="add">Add</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
