<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import type { Layout } from './DeckToolbar.vue'
import TokenDialog from './TokenDialog.vue'
import { GRID_COLUMNS, type CardSize } from '@/lib/cards'
import { cn } from '@/lib/utils'

/**
 * Tokens made by the cards shown (search and filters narrow it), one per kind (spec 015,
 * AC-2 to AC-4). A group after Maybeboard, styled like the view's other groups, rows
 * with just the name (spec 023, AC-3). Display only: counts toward nothing.
 */
const props = defineProps<{ deck: DeckDetail; cards: DeckCard[]; layout: Layout; editable: boolean; size?: CardSize }>()
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

const shown = computed(() => {
  const ids = new Set(props.cards.map((c) => c.id))
  return props.deck.tokens.filter((t) => t.makers.some((id) => ids.has(id)))
})
const openKind = ref<string | null>(null)
const open = computed({ get: () => openKind.value !== null, set: (v) => !v && (openKind.value = null) })
// Follow the token through a printing change: the kind stays, the id changes.
const token = computed(() => props.deck.tokens.find((t) => t.kind === openKind.value) ?? null)
const show = (t: Schemas['Token']) => (openKind.value = (t as Schemas['DeckToken']).kind)
</script>

<template>
  <section
    v-if="shown.length" :class="layout === 'visual' ? '' : layout === 'list' ? 'mb-5 break-inside-avoid' : 'mb-4 break-inside-avoid'"
    data-testid="deck-tokens"
  >
    <h3
      :class="cn('flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold', layout === 'visual' ? 'mb-2' : layout === 'list' ? 'mb-1 border-b pb-1' : 'mb-1')"
      data-testid="group-tokens"
    >
      Tokens <span class="font-normal text-muted-foreground">({{ shown.length }})</span>
    </h3>
    <ul v-if="layout === 'visual'" :class="cn('grid gap-3', GRID_COLUMNS[size ?? 'md'])">
      <li v-for="t in shown" :key="t.kind" data-testid="token">
        <CardPreview :image="t.image_normal" :name="t.name">
          <button type="button" :aria-label="t.name" class="block w-full" @click="show(t)">
            <img v-if="t.image_normal" :src="size === 'sm' ? t.image_small : t.image_normal" :alt="t.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
            <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ t.name }}</span>
          </button>
        </CardPreview>
      </li>
    </ul>
    <ul v-else>
      <li v-for="t in shown" :key="t.kind" data-testid="token">
        <CardPreview :image="t.image_normal" :name="t.name">
          <button
            type="button" :class="cn('flex w-full items-center gap-1.5 rounded px-1 text-left text-sm hover:bg-muted', layout === 'list' ? 'py-0.5' : 'leading-6')"
            :aria-label="t.name" data-testid="token-row" @click="show(t)"
          >
            <span class="w-5 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ t.name }}</span>
          </button>
        </CardPreview>
      </li>
    </ul>
    <TokenDialog v-model:open="open" :deck="deck" :token="token" :editable="editable" @changed="(d) => emit('changed', d)" />
  </section>
</template>
