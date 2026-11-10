<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import type { Layout } from './DeckToolbar.vue'
import TokenDialog from './TokenDialog.vue'
import TokenTiles from './TokenTiles.vue'

/**
 * Tokens made by the cards shown (search and filters narrow it), one per kind (spec 015,
 * AC-2 to AC-4): text rows in Text and List views, tiles in Images (spec 021, AC-8).
 * Display only: counts toward nothing.
 */
const props = defineProps<{ deck: DeckDetail; cards: DeckCard[]; layout: Layout; editable: boolean }>()
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
  <section v-if="shown.length" class="grid gap-2" data-testid="deck-tokens">
    <h3 class="text-sm font-semibold">Tokens <span class="font-normal text-muted-foreground">({{ shown.length }})</span></h3>
    <TokenTiles v-if="layout === 'visual'" :tokens="shown" openable @open="show" />
    <ul v-else class="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
      <li v-for="t in shown" :key="t.kind" class="break-inside-avoid" data-testid="token">
        <CardPreview :image="t.image_normal" :name="t.name">
          <button type="button" class="flex w-full items-center gap-1.5 rounded px-1 text-left text-sm leading-6 hover:bg-muted" :aria-label="t.name" data-testid="token-row" @click="show(t)">
            <span class="min-w-0 truncate">{{ t.name }}</span>
            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ t.type_line }}</span>
          </button>
        </CardPreview>
      </li>
    </ul>
    <TokenDialog v-model:open="open" :deck="deck" :token="token" :editable="editable" @changed="(d) => emit('changed', d)" />
  </section>
</template>
