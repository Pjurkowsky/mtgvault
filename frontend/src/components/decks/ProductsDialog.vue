<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDownIcon, ChevronRightIcon, LayoutGridIcon, PackageIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import CardSizeToggle from '@/components/CardSizeToggle.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePreference } from '@/composables/usePreference'
import { CARD_SIZES, type CardSize } from '@/lib/cards'
import { shownList, type DeckDetail } from '@/lib/decks'
import { cn } from '@/lib/utils'
import {
  CARDS_CHOICES, PRINTING_CHOICES, PRODUCT_COLUMNS, SECTIONS, SINCE_CHOICES, byType, chanceLabel, productYear,
  type CardsChoice, type PrintingChoice, type Section, type SinceChoice,
} from '@/lib/products'

type Found = Schemas['DeckProducts']
type Entry = Schemas['DeckProduct']

/** Products holding the deck's cards (spec 030, AC-1 to AC-7, AC-12): four tabs, photos, cards by type (spec 032). */
const props = defineProps<{ deck: DeckDetail; username: string | null }>()
const open = defineModel<boolean>('open', { required: true })

const cards = usePreference<CardsChoice>('products.cards', 'missing', CARDS_CHOICES.map((c) => c.value))
const printing = usePreference<PrintingChoice>('products.printing', 'any', PRINTING_CHOICES.map((c) => c.value))
const since = usePreference<SinceChoice>('products.since', '0', SINCE_CHOICES.map((c) => c.value))
const size = usePreference<CardSize>('products.size', 'sm', CARD_SIZES)
const tab = ref<Section>('precons')
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

const lists = computed(() => found.value?.sections ?? { precons: [], boosters: [], other_decks: [], other_boosters: [] })
const back = computed(() => props.username ? `/u/${props.username}/decks/${props.deck.id}` : `/decks/${props.deck.id}`)
const summary = (e: Entry) => `${e.count} ${e.count === 1 ? 'card' : 'cards'}`
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl" data-testid="products-dialog">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          Products to buy
          <InfoTip text="Sealed products that hold this deck's cards, from MTGJSON. A card's chance in a booster is for one pack." />
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
        <CardSizeToggle v-model="size" class="ml-auto" />
      </div>

      <p v-if="found && !found.synced" class="py-6 text-center text-sm text-muted-foreground" data-testid="products-no-data">No product data yet.</p>
      <p v-else-if="found && !found.cards" class="py-6 text-center text-sm text-muted-foreground" data-testid="products-no-cards">No cards to look for.</p>
      <template v-else-if="found">
        <Tabs v-model="tab" :class="loading && 'opacity-60'">
          <TabsList class="grid h-auto w-full grid-cols-2 sm:flex sm:w-fit">
            <TabsTrigger v-for="t in SECTIONS" :key="t.value" :value="t.value">
              {{ t.label }} <span class="text-muted-foreground tabular-nums">{{ lists[t.value].length }}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent v-for="t in SECTIONS" :key="t.value" :value="t.value" class="grid gap-1 pt-2" :data-testid="`products-${t.value}`">
            <p v-if="!lists[t.value].length" class="py-4 text-center text-sm text-muted-foreground">None</p>
            <div v-for="e in lists[t.value]" :key="e.product.code" class="min-w-0 rounded-md border" data-testid="product-row">
              <button
                type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                :aria-expanded="expanded.has(e.product.code)" @click="toggle(e.product.code)"
              >
                <component :is="expanded.has(e.product.code) ? ChevronDownIcon : ChevronRightIcon" class="size-4 shrink-0 text-muted-foreground" />
                <span class="flex h-16 w-12 shrink-0 items-center justify-center" data-testid="product-image">
                  <span v-if="e.commanders.length" class="relative h-16 w-12">
                    <img
                      v-for="(c, i) in e.commanders" :key="c.id" :src="c.image_small ?? undefined" :alt="c.name" loading="lazy"
                      :class="cn('absolute h-16 w-auto rounded-[4.75%/3.5%] bg-muted shadow-sm', i > 0 && 'left-2 top-1')"
                      data-testid="product-commander-image"
                    />
                  </span>
                  <img v-else-if="e.product.image" :src="e.product.image" :alt="e.product.name" loading="lazy" class="max-h-16 max-w-12 object-contain" data-testid="product-photo" />
                  <span v-else class="flex size-full items-center justify-center rounded-sm bg-muted text-muted-foreground" data-testid="product-placeholder"><PackageIcon class="size-5" /></span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium" data-testid="product-name">{{ e.product.name }}</span>
                  <span v-if="e.commanders.length" class="block truncate text-xs" data-testid="product-commanders">{{ e.commanders.map((c) => c.name).join(' · ') }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ e.product.set_name }} · {{ productYear(e.product) }}<template v-if="e.product.deck_type"> · {{ e.product.deck_type }}</template></span>
                </span>
                <span class="shrink-0 font-semibold tabular-nums" data-testid="product-summary">{{ summary(e) }}</span>
              </button>
              <div v-if="expanded.has(e.product.code)" class="grid gap-3 border-t px-3 py-3 text-sm" data-testid="product-cards">
                <section v-for="g in byType(e.cards)" :key="g.label" class="grid gap-1.5" data-testid="product-type">
                  <h4 class="text-xs font-medium text-muted-foreground">{{ g.label }} <span class="tabular-nums">{{ g.cards.length }}</span></h4>
                  <ul :class="cn('grid gap-2', PRODUCT_COLUMNS[size])" :data-size="size">
                    <li v-for="c in g.cards" :key="c.printing.id" class="relative" :aria-label="c.printing.name" data-testid="product-card">
                      <CardPreview :image="c.printing.image_normal" :back="c.printing.image_back_normal" :name="c.printing.name">
                        <img v-if="c.printing.image_small" :src="c.printing.image_small" :alt="c.printing.name" loading="lazy" class="w-full rounded-[4.75%/3.5%] bg-muted" />
                        <span v-else class="flex aspect-[63/88] w-full items-center rounded-[4.75%/3.5%] border bg-muted p-1 text-center text-xs leading-tight">{{ c.printing.name }}</span>
                      </CardPreview>
                      <span
                        v-if="c.chance !== null" class="absolute right-1 bottom-1 rounded bg-background/90 px-1 text-xs font-semibold tabular-nums shadow-sm"
                        data-testid="product-card-chance"
                      >{{ chanceLabel(c.chance) }}</span>
                      <span
                        v-else-if="c.copies > 1" class="absolute right-1 bottom-1 rounded bg-background/90 px-1 text-xs font-semibold tabular-nums shadow-sm"
                        data-testid="product-card-copies"
                      >×{{ c.copies }}</span>
                    </li>
                  </ul>
                </section>
                <RouterLink
                  :to="{ name: 'product', params: { code: e.product.code }, query: { from: back } }"
                  class="flex items-center gap-1 justify-self-start text-primary hover:underline"
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
