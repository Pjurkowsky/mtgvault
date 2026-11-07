<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import ExpandButton from '@/components/ExpandButton.vue'
import EdhrecCardGrid from './EdhrecCardGrid.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/composables/useConfirm'
import { showFullscreen } from '@/composables/useFullscreen'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf } from '@/lib/cards'
import { cn } from '@/lib/utils'

/**
 * Card detail (spec 002, AC-24 to AC-38): big image, reprints, your copies,
 * and EDHREC tabs. Cards opened from a tab stack up; the back arrow returns.
 */
const props = defineProps<{
  row: BrowserRow | null
  currency: string
  readonly?: boolean
  /** Open a card without a collection row (spec 005, AC-3): a deck card. */
  oracleId?: string | null
  /** With `oracleId`: the printing to show. */
  printingId?: string | null
  /** Reprints pick a printing (emits choose-printing) instead of switching the row's. */
  choosePrinting?: boolean
  /** Add to want list links this deck (spec 010, AC-4). */
  wantDeck?: number | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  changed: []; edit: [row: BrowserRow]; delete: [row: BrowserRow]; 'choose-printing': [printing: Schemas['Printing']]
  /** Add copies of a card you don't own (spec 010, AC-2, AC-3): the page opens its Add dialog. */
  add: [card: { oracle_id: string; name: string }, printingId: string | null]
}>()
defineSlots<{ deck?: () => unknown; want?: () => unknown }>()
const confirm = useConfirm()

type Entry = { oracleId: string; row: BrowserRow | null }

const stack = ref<Entry[]>([])
const card = ref<Schemas['CardDetail'] | null>(null)
const edhrec = ref<Schemas['Edhrec'] | null>(null)
const loadingEdhrec = ref(false)
const tab = ref('commanders')
// The tab whose cards are on screen. It follows `tab` one frame later, after
// the skeleton has painted, so switching never feels frozen.
const shownTab = ref('commanders')
watch(tab, (next) => {
  requestAnimationFrame(() => setTimeout(() => (shownTab.value = next)))
})

const current = computed(() => stack.value.at(-1) ?? null)
const row = computed(() => current.value?.row ?? null)
const ownRow = computed(() => !!row.value && !props.readonly)
// The card the dialog opened on, before any EDHREC card was stacked on top.
const atRoot = computed(() => stack.value.length === 1)
const picking = computed(() => !!props.choosePrinting && atRoot.value && !props.readonly)
const shown = computed(() => {
  const printings = card.value?.printings ?? []
  const wanted = row.value?.printing.id ?? (atRoot.value ? props.printingId : null)
  return printings.find((p) => p.id === wanted) ?? printings[0] ?? null
})

async function load() {
  const entry = current.value
  if (!entry) return
  card.value = null
  edhrec.value = null
  loadingEdhrec.value = true
  tab.value = 'commanders'
  shownTab.value = 'commanders'
  const path = { params: { path: { oracle_id: entry.oracleId } } }
  const [detail, tabs] = await Promise.all([
    api.GET('/api/catalog/cards/{oracle_id}/', path),
    api.GET('/api/catalog/cards/{oracle_id}/edhrec/', path),
  ])
  if (current.value !== entry) return // the user moved on meanwhile
  card.value = detail.data ?? null
  edhrec.value = tabs.data ?? null
  loadingEdhrec.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.row) stack.value = [{ oracleId: props.row.printing.oracle_id, row: props.row }]
  else if (props.oracleId) stack.value = [{ oracleId: props.oracleId, row: null }]
  else return
  load()
})
// After an edit the browser hands us the saved row.
watch(() => props.row, (next) => {
  if (next && stack.value[0]) stack.value[0].row = next
})

function push(oracleId: string | null | undefined) {
  if (!oracleId) return
  stack.value.push({ oracleId, row: null })
  load()
}
function back() {
  stack.value.pop()
  load()
}

// Add to want list: one more copy, any printing and finish (spec 010, AC-4).
const wanting = ref(false)
async function want() {
  if (!card.value || !shown.value) return
  wanting.value = true
  const { data } = await api.POST('/api/wants/', { body: { printing: shown.value.id, deck: props.wantDeck ?? null } })
  wanting.value = false
  if (!data) return toast.error('Could not add to the want list.')
  card.value = { ...card.value, wanted: data.wanted }
  toast.success(`Added ${shown.value.name} to the want list.`)
  emit('changed')
}
function add() {
  if (card.value) emit('add', { oracle_id: card.value.oracle_id, name: card.value.name }, shown.value?.id ?? null)
}

// Switch the row to another printing (AC-27).
async function switchTo(printing: Schemas['Printing']) {
  if (picking.value) return emit('choose-printing', printing)
  const r = row.value
  if (!ownRow.value || !r || printing.id === r.printing.id) return
  const copies = `${r.quantity} ${r.quantity === 1 ? 'copy' : 'copies'}`
  const ok = await confirm({
    title: `Switch to ${printing.set_name} #${printing.collector_number}?`,
    description: `Your ${copies} change to this printing.`,
    action: 'Switch',
    destructive: false,
  })
  if (!ok) return
  const { data, error } = await api.PATCH('/api/items/{id}/', { params: { path: { id: r.id } }, body: { printing: printing.id } })
  if (error || !data) return toast.error(Object.values(fieldErrors(error)).join(' '))
  toast.success(data.merged ? 'Switched. It matched another row, so the two merged.' : 'Switched printing.')
  stack.value[0].row = data.item as BrowserRow
  emit('changed')
}

const tabs = computed(() => [
  { value: 'commanders', label: 'Commanders' },
  { value: 'played_with', label: 'Played with' },
  { value: 'similar', label: 'Similar' },
])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="card-detail" @open-auto-focus.prevent>
      <DialogHeader>
        <div class="flex items-center gap-2">
          <IconButton v-if="stack.length > 1" label="Back" variant="ghost" class="size-7" @click="back"><ArrowLeftIcon /></IconButton>
          <DialogTitle>{{ shown?.name ?? card?.name ?? row?.printing.name }}</DialogTitle>
        </div>
        <DialogDescription v-if="shown">{{ shown.set_name }} #{{ shown.collector_number }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-6 md:grid-cols-[20rem_1fr]">
        <!-- Big image and reprints (AC-24, AC-26) -->
        <div class="grid content-start gap-3">
          <button v-if="shown" type="button" class="cursor-zoom-in" :aria-label="`Preview ${shown.name}`" @click="showFullscreen(shown.image_large || shown.image_normal, shown.name)">
            <img :src="shown.image_large || shown.image_normal" :alt="shown.name" class="w-full rounded-[4.75%/3.5%] bg-muted" data-testid="detail-image" />
          </button>
          <Skeleton v-else class="aspect-[488/680] w-full" />
          <div v-if="card" class="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Reprints" data-testid="reprints">
            <div v-for="p in card.printings" :key="p.id" class="group relative shrink-0">
            <ExpandButton :image="p.image_large || p.image_normal" :name="`${p.name} (${p.set_name})`" />
            <component
              :is="ownRow || picking ? 'button' : 'div'"
              :type="ownRow || picking ? 'button' : undefined"
              role="radio" :aria-checked="p.id === shown?.id" :aria-label="`${p.set_name} #${p.collector_number}`"
              class="block w-16 text-left"
              @click="switchTo(p)"
            >
              <img :src="p.image_small" alt="" loading="lazy" :class="cn('rounded-[4.75%/3.5%] bg-muted', p.id === shown?.id ? 'ring-2 ring-primary ring-offset-2' : (ownRow || picking) && 'opacity-70 hover:opacity-100')" />
              <span class="mt-1 block truncate text-[10px] uppercase">{{ p.set_code }} #{{ p.collector_number }}</span>
            </component>
            </div>
          </div>
        </div>

        <div class="grid content-start gap-6">
          <!-- A deck card: the deck section (spec 005, AC-3) -->
          <slot v-if="$slots.deck && atRoot" name="deck" />
          <!-- A want list entry (spec 010, AC-10) -->
          <slot v-else-if="$slots.want && atRoot" name="want" />
          <!-- Your copies (AC-25), or what you own of a card from a tab (AC-33, AC-34) -->
          <section v-else-if="row" class="grid gap-4" data-testid="copies">
            <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt class="text-muted-foreground">Quantity</dt><dd data-testid="detail-quantity">{{ row.quantity }}</dd></div>
              <div><dt class="text-muted-foreground">Finish</dt><dd>{{ labelOf(FINISHES, row.finish) }}</dd></div>
              <div><dt class="text-muted-foreground">Condition</dt><dd data-testid="detail-condition">{{ labelOf(CONDITIONS, row.condition) }}</dd></div>
              <div><dt class="text-muted-foreground">Language</dt><dd>{{ labelOf(LANGUAGES, row.language) }}</dd></div>
              <div v-if="!readonly"><dt class="text-muted-foreground">Location</dt><dd data-testid="detail-location">{{ row.location_name ?? 'Unfiled' }}</dd></div>
              <div><dt class="text-muted-foreground">Price</dt><dd data-testid="detail-price"><Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" /></dd></div>
              <template v-if="!readonly">
                <div><dt class="text-muted-foreground">Price when added</dt><dd data-testid="detail-added-price"><Price :value="row.added_price" :values="row.added_prices" :currency="currency" /></dd></div>
                <div><dt class="text-muted-foreground">Purchase price</dt><dd data-testid="detail-purchase-price"><Price :value="row.purchase_prices?.[currency as 'USD'] ?? null" :values="row.purchase_prices" :currency="currency" /></dd></div>
              </template>
            </dl>
            <div v-if="!readonly" class="flex gap-2">
              <Button variant="outline" @click="emit('edit', row)">Edit</Button>
              <Button variant="outline" class="text-destructive" @click="emit('delete', row)">Delete</Button>
            </div>
          </section>
          <section v-else-if="card" class="flex flex-wrap items-center gap-3" data-testid="copies">
            <span class="text-sm" data-testid="owned">You own {{ card.owned }}</span>
            <template v-if="!readonly">
              <Button @click="add">Add</Button>
              <Button variant="outline" :disabled="wanting" data-testid="add-want" @click="want">
                Add to want list<template v-if="card.wanted"> ({{ card.wanted }})</template>
              </Button>
            </template>
          </section>

          <!-- EDHREC tabs (AC-28 to AC-36) -->
          <Tabs v-model="tab">
            <TabsList>
              <TabsTrigger v-for="t in tabs" :key="t.value" :value="t.value">{{ t.label }}</TabsTrigger>
            </TabsList>
            <div v-if="loadingEdhrec" class="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
              <Skeleton v-for="n in 10" :key="n" class="aspect-[488/680] w-full" />
            </div>
            <p v-else-if="!edhrec?.available" class="mt-4 text-sm text-muted-foreground" data-testid="edhrec-empty">No EDHREC data</p>
            <!-- Render the new tab's cards a frame after the switch, so the tab responds at once. -->
            <div v-else-if="shownTab !== tab" class="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5" data-testid="edhrec-switching">
              <Skeleton v-for="n in 10" :key="n" class="aspect-[488/680] w-full" />
            </div>
            <div v-else class="mt-4">
              <EdhrecCardGrid v-if="shownTab === 'commanders'" :cards="edhrec.commanders" testid="edhrec-commanders" @open="push" />
              <div v-else-if="shownTab === 'played_with'" class="grid gap-5" data-testid="edhrec-played-with">
                <section v-for="g in edhrec.played_with" :key="g.group" class="grid gap-2">
                  <h3 class="text-sm font-medium">{{ g.group }}</h3>
                  <EdhrecCardGrid :cards="g.cards" :limit="10" @open="push" />
                </section>
              </div>
              <EdhrecCardGrid v-else :cards="edhrec.similar" testid="edhrec-similar" @open="push" />
            </div>
          </Tabs>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
