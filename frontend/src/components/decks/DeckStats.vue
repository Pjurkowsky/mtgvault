<script setup lang="ts">
import { computed } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import ManaSymbol from '@/components/ManaSymbol.vue'
import Price from '@/components/Price.vue'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DeckFilter } from '@/lib/deckFilter'
import { COLOR_NAMES, deckStats, type Bar } from '@/lib/deckStats'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import DeckSalt from './DeckSalt.vue'
import DeckThemes from './DeckThemes.vue'
import StatBars from './StatBars.vue'

/** Key numbers and charts for the counted zones; chart parts filter the Deck tab (spec 006, AC-16 to AC-18). */
const props = defineProps<{ deck: DeckDetail; themes: Schemas['DeckTheme'][] }>()
const emit = defineEmits<{ filter: [patch: Partial<DeckFilter>]; open: [card: DeckCard] }>()

const stats = computed(() => deckStats(props.deck.cards))
const peak = computed(() => Math.max(1, ...stats.value.curve.map((b) => b.creatures + b.other)))
const pick = (bar: Bar) => emit('filter', bar.filter)
const percent = (share: number) => `${Math.round(share * 100)}%`
const PLOT = 128 // px, the curve's plot height; the axis labels sit below it
</script>

<template>
  <div class="grid gap-4" data-testid="deck-stats">
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="key-numbers">
      <Card class="gap-1 p-3" data-testid="stat-cards"><dt class="text-xs text-muted-foreground">Cards</dt><dd class="text-xl font-semibold">{{ stats.cards }}</dd></Card>
      <Card class="gap-1 p-3" data-testid="stat-lands"><dt class="text-xs text-muted-foreground">Lands</dt><dd class="text-xl font-semibold">{{ stats.lands }}</dd></Card>
      <Card class="gap-1 p-3" data-testid="average-mv">
        <dt class="text-xs text-muted-foreground">Average mana value</dt>
        <dd class="text-xl font-semibold">{{ stats.averageNonland.toFixed(2) }}</dd>
        <dd class="text-xs text-muted-foreground">{{ stats.averageAll.toFixed(2) }} with lands</dd>
      </Card>
      <Card class="gap-1 p-3" data-testid="stat-value">
        <dt class="text-xs text-muted-foreground">Value</dt>
        <dd class="text-xl font-semibold"><Price :value="deck.stats.value.total" :values="deck.stats.values.total" :currency="deck.currency" /></dd>
      </Card>
      <Card class="gap-1 p-3" data-testid="stat-owned">
        <dt class="text-xs text-muted-foreground">Owned</dt>
        <dd class="text-xl font-semibold"><Price :value="deck.stats.value.owned" :values="deck.stats.values.owned" :currency="deck.currency" /></dd>
      </Card>
      <Card class="gap-1 p-3" data-testid="stat-missing">
        <dt class="text-xs text-muted-foreground">To buy</dt>
        <dd class="text-xl font-semibold"><Price :value="deck.stats.value.missing" :values="deck.stats.values.missing" :currency="deck.currency" /></dd>
      </Card>
    </dl>

    <!-- Their own row, so the charts below keep their pairs (spec 022, AC-12, AC-15). -->
    <div v-if="stats.cards || themes.length" class="grid gap-4 lg:grid-cols-2">
      <DeckSalt v-if="stats.cards" :salt="deck.salt" />
      <DeckThemes v-if="themes.length" :themes="themes" />
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="gap-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Mana curve</h3>
          <ul class="flex gap-3 text-xs text-muted-foreground">
            <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-series-1" />Creatures</li>
            <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-series-2" />Other spells</li>
          </ul>
        </div>
        <div class="flex items-end gap-1 border-b" :style="{ height: `${PLOT + 20}px` }" data-testid="mana-curve">
          <Tooltip v-for="bar in stats.curve" :key="bar.mv">
            <TooltipTrigger as-child>
              <button
                type="button" class="flex h-full flex-1 flex-col items-center justify-end rounded-t hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                :aria-label="`Mana value ${bar.mv}: ${bar.creatures} creatures, ${bar.other} other spells`" :data-mv="bar.mv"
                @click="emit('filter', { mv: [bar.mv] })"
              >
                <span class="text-xs tabular-nums text-muted-foreground" data-testid="curve-count">{{ bar.creatures + bar.other }}</span>
                <span class="flex w-full max-w-6 flex-col gap-0.5" :style="{ height: `${((bar.creatures + bar.other) / peak) * PLOT}px` }">
                  <span v-if="bar.other" class="rounded-t bg-series-2" :style="{ flexGrow: bar.other }" />
                  <span v-if="bar.creatures" class="bg-series-1" :class="!bar.other && 'rounded-t'" :style="{ flexGrow: bar.creatures }" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ bar.creatures }} creatures · {{ bar.other }} other spells</TooltipContent>
          </Tooltip>
        </div>
        <div class="flex gap-1">
          <span v-for="bar in stats.curve" :key="bar.mv" class="flex-1 text-center text-xs tabular-nums text-muted-foreground">{{ bar.mv }}</span>
        </div>
      </Card>

      <Card class="gap-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Colors</h3>
          <ul class="flex gap-3 text-xs text-muted-foreground">
            <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-series-1" />Mana symbols</li>
            <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-series-2" />Mana sources</li>
          </ul>
        </div>
        <ul v-if="stats.colors.length" class="grid gap-1" data-testid="colors">
          <li v-for="row in stats.colors" :key="row.color">
            <button
              type="button" class="grid w-full grid-cols-[1.5rem_1fr_6rem] items-center gap-3 rounded px-1.5 py-1 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              :aria-label="`Show ${COLOR_NAMES[row.color]}: ${percent(row.symbolShare)} of symbols, ${percent(row.sourceShare)} of sources`"
              :data-color="row.color" @click="emit('filter', { color: [row.color] })"
            >
              <ManaSymbol :symbol="row.color" />
              <span class="grid gap-0.5">
                <span class="h-2"><span class="block h-full rounded-r bg-series-1" :style="{ width: percent(row.symbolShare) }" /></span>
                <span class="h-2"><span class="block h-full rounded-r bg-series-2" :style="{ width: percent(row.sourceShare) }" /></span>
              </span>
              <span class="grid text-right text-xs tabular-nums text-muted-foreground" data-testid="color-shares">
                <span>{{ percent(row.symbolShare) }} · {{ row.symbols }}</span>
                <span>{{ percent(row.sourceShare) }} · {{ row.sources }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-muted-foreground">No colored mana.</p>
      </Card>

      <Card class="gap-3 p-4" data-testid="types">
        <h3 class="text-sm font-semibold">Types</h3>
        <StatBars :bars="stats.types" @pick="pick" />
      </Card>

      <Card class="gap-3 p-4" data-testid="rarities">
        <h3 class="text-sm font-semibold">Rarity</h3>
        <StatBars :bars="stats.rarities" @pick="pick" />
      </Card>

      <Card v-if="stats.categories.length" class="gap-3 p-4" data-testid="categories">
        <h3 class="text-sm font-semibold">Categories</h3>
        <StatBars :bars="stats.categories" @pick="pick" />
      </Card>

      <Card class="gap-3 p-4" data-testid="sets">
        <h3 class="text-sm font-semibold">Most used sets</h3>
        <StatBars :bars="stats.sets" @pick="pick" />
      </Card>

      <Card v-if="stats.expensive.length" class="gap-3 p-4" data-testid="expensive">
        <h3 class="text-sm font-semibold">Most expensive</h3>
        <ol class="grid gap-0.5">
          <li v-for="card in stats.expensive" :key="card.id">
            <CardPreview :image="card.printing.image_normal" :back="card.printing.image_back_normal" :name="card.printing.name">
              <button
                type="button" class="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                :aria-label="card.printing.name" data-testid="expensive-card" @click="emit('open', card)"
              >
                <span class="min-w-0 flex-1 truncate">{{ card.printing.name }}</span>
                <span v-if="card.quantity > 1" class="text-xs text-muted-foreground">×{{ card.quantity }}</span>
                <span class="w-16 text-right tabular-nums text-muted-foreground"><Price :value="card.price" :values="card.prices" :currency="deck.currency" /></span>
              </button>
            </CardPreview>
          </li>
        </ol>
      </Card>
    </div>
  </div>
</template>
