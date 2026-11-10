<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRightIcon, ChevronDownIcon, Link2OffIcon, PlusIcon } from '@lucide/vue'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

const byName = (a: DeckCard, b: DeckCard) => a.printing.name.localeCompare(b.printing.name)
const unpaired = computed(() => props.deck.cards.filter((c) => c.zone === 'maybe' && !c.swap_for.length).sort(byName))
const groups = computed(() =>
  props.deck.cards
    .filter((card) => card.zone !== 'maybe')
    .map((card) => ({ card, candidates: props.deck.cards.filter((c) => c.swap_for.includes(card.id)).sort(byName) }))
    .filter((g) => g.candidates.length)
    .sort((a, b) => byName(a.card, b.card)),
)

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
    <Button v-if="!readonly" variant="outline" class="justify-self-end" @click="emit('propose', null)"><PlusIcon /> Propose swap</Button>

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
            <Button v-if="!readonly" size="sm" variant="outline" @click="emit('propose', c)"><ArrowLeftRightIcon /> Pair with…</Button>
          </div>
          <div class="flex min-w-0 items-center gap-3">
            <CardPreview :image="c.printing.image_normal" :name="c.printing.name">
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
              <Button v-if="!readonly" size="sm" :disabled="blocked(c)" @click="emit('apply', c, card)"><ArrowLeftRightIcon /> Swap</Button>
              <ArrowLeftRightIcon v-else class="size-5" />
              <Tooltip v-if="blocked(c)">
                <TooltipTrigger as-child>
                  <Badge variant="outline" class="border-amber-500/60 text-amber-700 dark:text-amber-400" tabindex="0" data-testid="in-deck">In deck</Badge>
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
              <CardPreview :image="side.printing.image_normal" :name="side.printing.name">
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
