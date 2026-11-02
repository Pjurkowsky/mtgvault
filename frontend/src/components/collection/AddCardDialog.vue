<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeftIcon, LayoutGridIcon, ListIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePreference } from '@/composables/usePreference'
import type { Finish } from '@/lib/cards'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'
import ItemFields, { type ItemForm } from './ItemFields.vue'
import PrintingPicker from './PrintingPicker.vue'

/** Location to preselect: an id, or null for Unfiled. */
const props = defineProps<{ defaultLocation: number | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ added: [] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

// Result layout, remembered per browser (AC-7, AC-8).
const view = usePreference('add.view', 'grid', ['grid', 'list'] as const)
const size = usePreference('add.size', 'md', ['sm', 'md', 'lg'] as const)
const GRID_COLUMNS = { sm: 'grid-cols-4 sm:grid-cols-6', md: 'grid-cols-3 sm:grid-cols-4', lg: 'grid-cols-2 sm:grid-cols-3' }

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
  printingId.value = printings.value[0]?.id ?? null
}

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
  const keepLocation = f.location
  reset()
  form.value.location = keepLocation
  await nextTick()
  ;(searchInput.value?.$el as HTMLInputElement | undefined)?.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Add card</DialogTitle>
      </DialogHeader>

      <div class="flex gap-2">
        <Input ref="searchInput" v-model="query" placeholder="Card name" aria-label="Card name" autocomplete="off" autofocus />
        <template v-if="!card">
          <ToggleGroup type="single" variant="outline" :model-value="view" @update:model-value="(v) => v && (view = v as 'grid' | 'list')">
            <Tooltip>
              <TooltipTrigger as-child><ToggleGroupItem value="grid" aria-label="Results as grid"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
              <TooltipContent>Results as grid</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child><ToggleGroupItem value="list" aria-label="Results as list"><ListIcon /></ToggleGroupItem></TooltipTrigger>
              <TooltipContent>Results as list</TooltipContent>
            </Tooltip>
          </ToggleGroup>
          <ToggleGroup v-if="view === 'grid'" type="single" variant="outline" :model-value="size" aria-label="Card size" @update:model-value="(v) => v && (size = v as 'sm' | 'md' | 'lg')">
            <ToggleGroupItem value="sm" aria-label="Small cards">S</ToggleGroupItem>
            <ToggleGroupItem value="md" aria-label="Medium cards">M</ToggleGroupItem>
            <ToggleGroupItem value="lg" aria-label="Large cards">L</ToggleGroupItem>
          </ToggleGroup>
        </template>
      </div>

      <template v-if="!card && results.length">
        <ul v-if="view === 'grid'" :class="cn('grid gap-3', GRID_COLUMNS[size])" data-testid="card-results" :data-size="size">
          <li v-for="r in results" :key="r.oracle_id">
            <CardPreview :image="r.image_normal" :name="r.name">
              <button type="button" class="block w-full" :aria-label="r.name" @click="choose(r)">
                <img :src="size === 'sm' ? r.image_small : r.image_normal || r.image_small" :alt="r.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted object-cover transition hover:ring-2 hover:ring-primary" />
              </button>
            </CardPreview>
          </li>
        </ul>
        <ul v-else class="grid max-h-96 gap-1 overflow-y-auto" data-testid="card-results">
          <li v-for="r in results" :key="r.oracle_id">
            <CardPreview :image="r.image_normal" :name="r.name">
              <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted" :aria-label="r.name" @click="choose(r)">
                <img :src="r.image_small" alt="" class="h-14 rounded-sm" loading="lazy" />
                <span>{{ r.name }}</span>
              </button>
            </CardPreview>
          </li>
        </ul>
      </template>
      <p v-else-if="!card && query.trim().length >= 2 && !searching" class="text-sm text-muted-foreground">No cards found.</p>

      <template v-if="card">
        <div class="flex items-center gap-2">
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
