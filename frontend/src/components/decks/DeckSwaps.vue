<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDownWideNarrowIcon, ArrowLeftRightIcon, ArrowUpNarrowWideIcon, ChevronDownIcon, Link2OffIcon, PlusIcon } from '@lucide/vue'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePreference } from '@/composables/usePreference'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/**
 * Every Maybeboard card: the unpaired ones first, then pairs of a deck card and a proposed
 * replacement, mirrored around the swap button, with Unpair at the end
 * (spec 005 AC-10, spec 006 AC-10, AC-11, spec 011 AC-3, spec 021 AC-12 to AC-19).
 */
const props = defineProps<{ deck: DeckDetail; readonly?: boolean }>()
const emit = defineEmits<{
  open: [card: DeckCard]
  apply: [candidate: DeckCard, out: DeckCard]
  unpair: [candidate: DeckCard, out: DeckCard]
  propose: [into: DeckCard | null]
}>()

// Sort by name or by date, either way; remembered for all decks (spec 028, AC-1 to AC-3).
type SortKey = 'name' | 'date'
type Direction = 'asc' | 'desc'
const sortKey = usePreference<SortKey>('deck.swapSort', 'name', ['name', 'date'])
const direction = usePreference<Direction>('deck.swapDir', 'asc', ['asc', 'desc'])
/** Date starts newest first, Name A→Z. */
function setSort(key: SortKey) {
  sortKey.value = key
  direction.value = key === 'date' ? 'desc' : 'asc'
}
const flip = () => (direction.value = direction.value === 'asc' ? 'desc' : 'asc')

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null)
/** Undated (swaps from before spec 028) count as the oldest, in name order among themselves. */
function order<T>(items: T[], date: (item: T) => number | null, name: (item: T) => string): T[] {
  const sign = direction.value === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    if (sortKey.value === 'name') return sign * name(a).localeCompare(name(b))
    const [x, y] = [date(a), date(b)]
    if (x === y || (x === null && y === null)) return name(a).localeCompare(name(b))
    if (x === null) return -sign
    if (y === null) return sign
    return sign * (x - y)
  })
}
const proposed = (candidate: DeckCard, out: DeckCard) => time(candidate.swap_dates[String(out.id)])
const unpaired = computed(() =>
  order(props.deck.cards.filter((c) => c.zone === 'maybe' && !c.swap_for.length), (c) => time(c.added_at), (c) => c.printing.name))
const groups = computed(() => {
  const list = props.deck.cards
    .filter((card) => card.zone !== 'maybe')
    .map((card) => {
      const candidates = order(props.deck.cards.filter((c) => c.swap_for.includes(card.id)), (c) => proposed(c, card), (c) => c.printing.name)
      const dates = candidates.map((c) => proposed(c, card)).filter((d): d is number => d !== null)
      return { card, candidates, newest: dates.length ? Math.max(...dates) : null }
    })
    .filter((g) => g.candidates.length)
  return order(list, (g) => g.newest, (g) => g.card.printing.name)
})
const DAY = { dateStyle: 'medium' } as const
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, DAY) : null)

// Folded sections, remembered per deck in this browser (spec 006 AC-11, spec 021 AC-12).
type Fold = number | 'unpaired'
const key = computed(() => `mtgvault.swaps.collapsed.${props.deck.id}`)
const collapsed = ref<Fold[]>([])
watch(key, (k) => {
  try {
    collapsed.value = JSON.parse(localStorage.getItem(k) ?? '[]')
  } catch {
    collapsed.value = []
  }
}, { immediate: true })
function toggle(id: Fold) {
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter((x) => x !== id) : [...collapsed.value, id]
  try {
    localStorage.setItem(key.value, JSON.stringify(collapsed.value))
  } catch {
    /* still folds for this visit */
  }
}

function signed(value: number, text: string) {
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}
function priceDiff(out: DeckCard, into: DeckCard) {
  if (out.price === null || into.price === null) return '–'
  const diff = into.price - out.price
  return signed(diff, formatMoney(Math.abs(diff), props.deck.currency))
}
const mv = (card: DeckCard) => Number(card.printing.cmc)
const mvDiff = (out: DeckCard, into: DeckCard) => signed(mv(into) - mv(out), String(Math.abs(mv(into) - mv(out))))
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
/** The proposed card went into the deck: the pair waits until it's back in the Maybeboard (AC-18). */
const blocked = (candidate: DeckCard) => candidate.zone !== 'maybe'
const ROW = 'grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_3.25rem]'
</script>

<template>
  <div class="grid gap-4" data-testid="deck-swaps">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <Select :model-value="sortKey" @update:model-value="(v) => setSort(v as SortKey)">
        <SelectTrigger class="w-28" aria-label="Sort swaps" data-testid="swap-sort"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="date">Date</SelectItem>
        </SelectContent>
      </Select>
      <IconButton
        :label="sortKey === 'date' ? (direction === 'desc' ? 'Newest first' : 'Oldest first') : direction === 'asc' ? 'A to Z' : 'Z to A'"
        variant="outline" data-testid="swap-direction" :data-direction="direction" @click="flip"
      >
        <ArrowDownWideNarrowIcon v-if="direction === 'desc'" /><ArrowUpNarrowWideIcon v-else />
      </IconButton>
      <Button v-if="!readonly" variant="outline" @click="emit('propose', null)"><PlusIcon /> Propose swap</Button>
    </div>

    <section v-if="unpaired.length" class="rounded-lg border" data-testid="swap-unpaired">
      <button
        type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50"
        :aria-expanded="!collapsed.includes('unpaired')" @click="toggle('unpaired')"
      >
        <ChevronDownIcon :class="cn('size-4 transition-transform', collapsed.includes('unpaired') && '-rotate-90')" />
        Unpaired <span class="font-normal text-muted-foreground">· {{ count(unpaired.length, 'card', 'cards') }}</span>
      </button>
      <ul v-if="!collapsed.includes('unpaired')" class="divide-y border-t">
        <li v-for="c in unpaired" :key="c.id" :class="ROW" data-testid="unpaired-card">
          <span class="hidden sm:block" />
          <div class="grid justify-items-center">
            <Tooltip v-if="!readonly" :disabled="!day(c.added_at)">
              <TooltipTrigger as-child>
                <Button size="sm" variant="outline" data-testid="pair-with" @click="emit('propose', c)"><ArrowLeftRightIcon /> Pair with…</Button>
              </TooltipTrigger>
              <TooltipContent>Added {{ day(c.added_at) }}</TooltipContent>
            </Tooltip>
          </div>
          <div class="flex min-w-0 items-center gap-3">
            <CardPreview :image="c.printing.image_normal" :back="c.printing.image_back_normal" :name="c.printing.name">
              <button type="button" class="shrink-0" :aria-label="c.printing.name" @click="emit('open', c)">
                <img :src="c.printing.image_small" :alt="c.printing.name" loading="lazy" class="w-16 rounded-[4.75%/3.5%] bg-muted" />
              </button>
            </CardPreview>
            <div class="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span class="flex max-w-full items-center gap-1.5 font-medium">
                <span class="truncate">{{ c.printing.name }}</span> <ManaCost :cost="c.printing.mana_cost" class="shrink-0" />
              </span>
              <span class="text-muted-foreground">
                <Price :value="c.price" :values="c.prices" :currency="deck.currency" /> · Mana value {{ mv(c) }}
              </span>
              <OwnershipBadge :card="c" show-label />
            </div>
          </div>
          <span class="hidden sm:block" />
        </li>
      </ul>
    </section>

    <section v-for="{ card, candidates } in groups" :key="card.id" class="rounded-lg border" :data-testid="`swap-${card.printing.name}`">
      <button
        type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50"
        :aria-expanded="!collapsed.includes(card.id)" @click="toggle(card.id)"
      >
        <ChevronDownIcon :class="cn('size-4 transition-transform', collapsed.includes(card.id) && '-rotate-90')" />
        {{ card.printing.name }} <span class="font-normal text-muted-foreground">· {{ count(candidates.length, 'proposal', 'proposals') }}</span>
      </button>
      <ul v-if="!collapsed.includes(card.id)" class="divide-y border-t">
        <li
          v-for="c in candidates" :key="c.id" :class="cn(ROW, blocked(c) && 'bg-amber-500/10')"
          :data-blocked="blocked(c) || undefined" data-testid="swap-candidate"
        >
          <template v-for="(side, i) in [card, c]" :key="side.id">
            <div v-if="i === 1" class="grid justify-items-center gap-1 text-center text-xs text-muted-foreground">
              <!-- When it was proposed (AC-4); a span, so a disabled button still shows it -->
              <Tooltip :disabled="!day(c.swap_dates[String(card.id)])">
                <TooltipTrigger as-child>
                  <span class="inline-flex" :tabindex="readonly || blocked(c) ? 0 : undefined" data-testid="swap-when">
                    <Button v-if="!readonly" size="sm" :disabled="blocked(c)" @click="emit('apply', c, card)"><ArrowLeftRightIcon /> Swap</Button>
                    <ArrowLeftRightIcon v-else class="size-5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Proposed {{ day(c.swap_dates[String(card.id)]) }}</TooltipContent>
              </Tooltip>
              <Tooltip v-if="blocked(c)">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="border-amber-500/60 text-amber-700 dark:text-amber-400 dark:text-amber-400" tabindex="0" data-testid="in-deck">In deck</Badge>
                </TooltipTrigger>
                <TooltipContent>{{ c.printing.name }} is already in the deck</TooltipContent>
              </Tooltip>
              <span data-testid="swap-price">Price {{ priceDiff(card, c) }}</span>
              <span data-testid="swap-mv">Mana value {{ mvDiff(card, c) }}</span>
            </div>
            <!-- The card going out mirrors the one coming in: its image sits next to the middle. -->
            <div
              :class="cn('flex min-w-0 items-center gap-3', i === 0 && 'sm:flex-row-reverse sm:text-right')"
              :data-testid="i === 0 ? 'swap-out' : 'swap-in'"
            >
              <CardPreview :image="side.printing.image_normal" :back="side.printing.image_back_normal" :name="side.printing.name">
                <button type="button" class="shrink-0" :aria-label="side.printing.name" @click="emit('open', side)">
                  <img :src="side.printing.image_small" :alt="side.printing.name" loading="lazy" class="w-16 rounded-[4.75%/3.5%] bg-muted" />
                </button>
              </CardPreview>
              <div :class="cn('grid min-w-0 flex-1 gap-0.5 text-sm', i === 0 && 'sm:justify-items-end')">
                <span :class="cn('flex max-w-full items-center gap-1.5 font-medium', i === 0 && 'sm:flex-row-reverse')">
                  <span class="truncate">{{ side.printing.name }}</span> <ManaCost :cost="side.printing.mana_cost" class="shrink-0" />
                </span>
                <span class="text-muted-foreground">
                  <Price :value="side.price" :values="side.prices" :currency="deck.currency" /> · Mana value {{ mv(side) }}
                </span>
                <OwnershipBadge :card="side" show-label />
              </div>
            </div>
          </template>
          <!-- Unpair sits apart from the cards (AC-16). -->
          <div v-if="!readonly" class="flex justify-end border-t pt-3 sm:h-full sm:items-center sm:justify-center sm:border-t-0 sm:border-l sm:pt-0" data-testid="swap-actions">
            <IconButton label="Unpair" variant="ghost" @click="emit('unpair', c, card)"><Link2OffIcon /></IconButton>
          </div>
        </li>
      </ul>
    </section>

    <p v-if="!unpaired.length && !groups.length" class="py-16 text-center text-muted-foreground">No swaps proposed.</p>
  </div>
</template>
