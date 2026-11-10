<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DeckCard, DeckDetail } from '@/lib/decks'
import ComboRow from './ComboRow.vue'

/** Combos in the deck and infinite ones it could build (spec 022, AC-6 to AC-11). */
const props = defineProps<{ deck: DeckDetail; username: string | null; editable: boolean }>()
const emit = defineEmits<{ open: [card: DeckCard]; changed: [deck: DeckDetail] }>()

const PAGE = 20
const combos = ref<Schemas['DeckCombos'] | null>(null)
const failed = ref(false)
const shown = ref(PAGE)

// Reload when the counted cards change, not on every edit (categories, printings).
const signature = computed(() =>
  props.deck.cards.filter((c) => c.zone !== 'maybe').map((c) => c.printing.oracle_id).sort().join())
async function load() {
  failed.value = false
  const { data } = props.username
    ? await api.GET('/api/users/{username}/decks/{id}/combos/', { params: { path: { username: props.username, id: props.deck.id } } })
    : await api.GET('/api/decks/{id}/combos/', { params: { path: { id: props.deck.id } } })
  combos.value = data ?? null
  failed.value = !data
}
watch(signature, load, { immediate: true })

const groups = computed(() => [
  { key: 'in-deck', title: 'In deck', combos: combos.value?.in_deck ?? [] },
  { key: 'could-build', title: 'Could build', combos: (combos.value?.could_build ?? []).slice(0, shown.value), total: combos.value?.could_build.length ?? 0 },
])

function open(card: Schemas['ComboCard']) {
  const found = props.deck.cards.find((c) => c.printing.oracle_id === card.oracle_id && c.zone !== 'maybe')
  if (found) emit('open', found)
}

async function add(card: Schemas['ComboCard']) {
  const { data } = await api.POST('/api/decks/{id}/cards/', {
    params: { path: { id: props.deck.id } }, body: { printing: card.printing!, zone: 'maybe' },
  })
  if (!data) return toast.error(`Could not add ${card.name}.`)
  toast.success(`Added ${card.name} to the Maybeboard.`)
  emit('changed', data)
}
</script>

<template>
  <div class="grid gap-6" data-testid="deck-combos">
    <Alert v-if="failed" variant="destructive" class="bg-destructive/10"><AlertDescription>Could not load combos.</AlertDescription></Alert>
    <template v-else-if="combos">
      <section v-for="group in groups" :key="group.key" class="grid gap-3" :data-testid="`combos-${group.key}`">
        <h2 class="text-sm font-semibold">
          {{ group.title }} <span class="font-normal text-muted-foreground" data-testid="combos-count">{{ group.total ?? group.combos.length }}</span>
        </h2>
        <div v-if="group.combos.length" class="grid gap-3 xl:grid-cols-2">
          <ComboRow v-for="combo in group.combos" :key="combo.id" :combo="combo" :editable="editable" @open="open" @add="add" />
        </div>
        <p v-else class="text-sm text-muted-foreground">No combos.</p>
        <Button
          v-if="group.total && group.total > shown" variant="outline" class="justify-self-start" data-testid="combos-more"
          @click="shown += PAGE"
        >Show more</Button>
      </section>
    </template>
    <div v-else class="grid gap-3"><Skeleton class="h-40 w-full" /><Skeleton class="h-40 w-full" /></div>
    <p class="text-xs text-muted-foreground">
      Combos from <a href="https://commanderspellbook.com" target="_blank" rel="noopener" class="underline hover:text-foreground">Commander Spellbook</a>
    </p>
  </div>
</template>
