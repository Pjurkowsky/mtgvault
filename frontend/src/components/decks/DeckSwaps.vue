<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRightIcon, ChevronDownIcon, Trash2Icon } from '@lucide/vue'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import ManaCost from './ManaCost.vue'
import OwnershipBadge from './OwnershipBadge.vue'

/**
 * Pairs of the card in the deck and a proposed replacement, mirrored around the swap button,
 * with a trash icon at the end (spec 005 AC-10, spec 006 AC-10, AC-11, spec 011 AC-3).
 */
const props = defineProps<{ deck: DeckDetail; readonly?: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; apply: [candidate: DeckCard]; remove: [candidate: DeckCard] }>()

const groups = computed(() =>
  props.deck.cards
    .map((card) => ({ card, candidates: props.deck.cards.filter((c) => c.swap_for === card.id) }))
    .filter((g) => g.candidates.length)
    .sort((a, b) => a.card.printing.name.localeCompare(b.card.printing.name)),
)

// Collapsed groups, remembered per deck in this browser (AC-11).
const key = computed(() => `mtgvault.swaps.collapsed.${props.deck.id}`)
const collapsed = ref<number[]>([])
watch(key, (k) => {
  try {
    collapsed.value = JSON.parse(localStorage.getItem(k) ?? '[]')
  } catch {
    collapsed.value = []
  }
}, { immediate: true })
function toggle(id: number) {
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter((x) => x !== id) : [...collapsed.value, id]
  try {
    localStorage.setItem(key.value, JSON.stringify(collapsed.value))
  } catch {
    /* still collapses for this visit */
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
const proposals = (n: number) => `${n} ${n === 1 ? 'proposal' : 'proposals'}`
</script>

<template>
  <div v-if="groups.length" class="grid gap-4" data-testid="deck-swaps">
    <section v-for="{ card, candidates } in groups" :key="card.id" class="rounded-lg border" :data-testid="`swap-${card.printing.name}`">
      <button
        type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50"
        :aria-expanded="!collapsed.includes(card.id)" @click="toggle(card.id)"
      >
        <ChevronDownIcon :class="cn('size-4 transition-transform', collapsed.includes(card.id) && '-rotate-90')" />
        {{ card.printing.name }} <span class="font-normal text-muted-foreground">· {{ proposals(candidates.length) }}</span>
      </button>
      <ul v-if="!collapsed.includes(card.id)" class="divide-y border-t">
        <li
          v-for="c in candidates" :key="c.id"
          class="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_2.25rem]" data-testid="swap-candidate"
        >
          <template v-for="(side, i) in [card, c]" :key="side.id">
            <div v-if="i === 1" class="grid justify-items-center gap-1 text-center text-xs text-muted-foreground">
              <Button v-if="!readonly" size="sm" @click="emit('apply', c)"><ArrowLeftRightIcon /> Swap</Button>
              <ArrowLeftRightIcon v-else class="size-5" />
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
          <IconButton v-if="!readonly" label="Remove" variant="ghost" class="justify-self-end text-destructive hover:text-destructive" @click="emit('remove', c)">
            <Trash2Icon />
          </IconButton>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="py-16 text-center text-muted-foreground">No swaps proposed.</p>
</template>
