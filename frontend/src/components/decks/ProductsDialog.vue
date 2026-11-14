<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDownIcon, ChevronRightIcon, LayoutGridIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePreference } from '@/composables/usePreference'
import { shownList, type DeckDetail } from '@/lib/decks'
import { CARDS_CHOICES, PRINTING_CHOICES, SINCE_CHOICES, chanceLabel, productYear, type CardsChoice, type PrintingChoice, type SinceChoice } from '@/lib/products'

type Found = Schemas['DeckProducts']
type Entry = Schemas['DeckProduct']

/** Products holding the deck's cards: fixed decks and boosters (spec 030, AC-1 to AC-7, AC-12). */
const props = defineProps<{ deck: DeckDetail; username: string | null }>()
const open = defineModel<boolean>('open', { required: true })

const cards = usePreference<CardsChoice>('products.cards', 'missing', CARDS_CHOICES.map((c) => c.value))
const printing = usePreference<PrintingChoice>('products.printing', 'any', PRINTING_CHOICES.map((c) => c.value))
const since = usePreference<SinceChoice>('products.since', '0', SINCE_CHOICES.map((c) => c.value))
const tab = ref<'decks' | 'boosters'>('decks')
const found = ref<Found | null>(null)
const loading = ref(false)
const expanded = ref<Set<string>>(new Set())

async function load() {
  if (!open.value) return
  loading.value = true
  const query = { ...shownList(props.deck), cards: cards.value, printing: printing.value, since: Number(since.value) as 0 | 1 | 2 | 3 | 4 }
  const { data } = props.username
    ? await api.GET('/api/users/{username}/decks/{id}/products/', { params: { path: { username: props.username, id: props.deck.id }, query } })
    : await api.GET('/api/decks/{id}/products/', { params: { path: { id: props.deck.id }, query } })
  loading.value = false
  found.value = data ?? null
}
watch([open, cards, printing, since], load, { immediate: true })

function toggle(code: string) {
  const next = new Set(expanded.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  expanded.value = next
}

const lists = computed(() => ({ decks: found.value?.decks ?? [], boosters: found.value?.boosters ?? [] }))
const back = computed(() => props.username ? `/u/${props.username}/decks/${props.deck.id}` : `/decks/${props.deck.id}`)
const summary = (e: Entry, kind: 'decks' | 'boosters') =>
  kind === 'boosters' ? `${chanceLabel(e.chance ?? 0)} per pack` : `${e.count} ${e.count === 1 ? 'card' : 'cards'}`
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl" data-testid="products-dialog">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          Products to buy
          <InfoTip text="Sealed products that hold this deck's cards, from MTGJSON. Booster chances are for one pack." />
        </DialogTitle>
        <DialogDescription class="sr-only">Decks and boosters that hold the deck's cards</DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap gap-2">
        <Select v-model="cards">
          <SelectTrigger class="w-32" aria-label="Cards"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="c in CARDS_CHOICES" :key="c.value" :value="c.value">{{ c.label }}</SelectItem></SelectContent>
        </Select>
        <Select v-model="printing">
          <SelectTrigger class="w-40" aria-label="Printing"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="c in PRINTING_CHOICES" :key="c.value" :value="c.value">{{ c.label }}</SelectItem></SelectContent>
        </Select>
        <Select v-model="since">
          <SelectTrigger class="w-40" aria-label="Released"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="c in SINCE_CHOICES" :key="c.value" :value="c.value">{{ c.label }}</SelectItem></SelectContent>
        </Select>
      </div>

      <p v-if="found && !found.synced" class="py-6 text-center text-sm text-muted-foreground" data-testid="products-no-data">No product data yet.</p>
      <p v-else-if="found && !found.cards" class="py-6 text-center text-sm text-muted-foreground" data-testid="products-no-cards">No cards to look for.</p>
      <template v-else-if="found">
        <Tabs v-model="tab" :class="loading && 'opacity-60'">
          <TabsList>
            <TabsTrigger value="decks">Decks <span class="text-muted-foreground tabular-nums">{{ lists.decks.length }}</span></TabsTrigger>
            <TabsTrigger value="boosters">Boosters <span class="text-muted-foreground tabular-nums">{{ lists.boosters.length }}</span></TabsTrigger>
          </TabsList>
          <TabsContent v-for="kind in (['decks', 'boosters'] as const)" :key="kind" :value="kind" class="grid gap-1 pt-2" :data-testid="`products-${kind}`">
            <p v-if="!lists[kind].length" class="py-4 text-center text-sm text-muted-foreground">None</p>
            <div v-for="e in lists[kind]" :key="e.product.code" class="min-w-0 rounded-md border" data-testid="product-row">
              <button
                type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                :aria-expanded="expanded.has(e.product.code)" @click="toggle(e.product.code)"
              >
                <component :is="expanded.has(e.product.code) ? ChevronDownIcon : ChevronRightIcon" class="size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium" data-testid="product-name">{{ e.product.name }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ e.product.set_name }} · {{ productYear(e.product) }}<template v-if="e.product.deck_type"> · {{ e.product.deck_type }}</template></span>
                </span>
                <span class="shrink-0 font-semibold tabular-nums" data-testid="product-summary">{{ summary(e, kind) }}</span>
              </button>
              <div v-if="expanded.has(e.product.code)" class="grid gap-0.5 border-t px-3 py-2 text-sm" data-testid="product-cards">
                <div v-for="c in e.cards" :key="c.printing.id" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2" data-testid="product-card">
                  <span class="min-w-0 truncate">
                    <CardPreview :image="c.printing.image_normal" :back="c.printing.image_back_normal" :name="c.printing.name">
                      <span>{{ c.printing.name }}</span>
                    </CardPreview>
                  </span>
                  <span class="text-xs uppercase text-muted-foreground">{{ c.printing.set_code }} #{{ c.printing.collector_number }}</span>
                  <span class="min-w-10 text-right text-xs tabular-nums" data-testid="product-card-chance">{{ c.chance !== null ? chanceLabel(c.chance) : '' }}</span>
                </div>
                <RouterLink
                  :to="{ name: 'product', params: { code: e.product.code }, query: { from: back } }"
                  class="mt-1 flex items-center gap-1 justify-self-start text-primary hover:underline"
                  data-testid="product-all-cards"
                ><LayoutGridIcon class="size-4" /> All cards</RouterLink>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <section v-if="found.none.length" class="grid gap-1" data-testid="products-none">
          <h3 class="flex items-center gap-1 border-b pb-1 text-sm font-medium">
            Not in any product <InfoTip text="Buy these as singles" />
          </h3>
          <CardPreview v-for="p in found.none" :key="p.id" :image="p.image_normal" :back="p.image_back_normal" :name="p.name">
            <span class="truncate text-sm" data-testid="products-none-card">{{ p.name }}</span>
          </CardPreview>
        </section>
      </template>
    </DialogContent>
  </Dialog>
</template>
