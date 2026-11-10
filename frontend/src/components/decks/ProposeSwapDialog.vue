<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import CardSearch from '@/components/collection/CardSearch.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ZONE_LABELS, type DeckCard, type DeckDetail, type Zone } from '@/lib/decks'

/**
 * Propose a swap: a deck card out, a Maybeboard card or any card in (spec 005 AC-9, spec 021
 * AC-14, AC-15). Opens empty, or with Out or In filled in.
 */
const props = defineProps<{ deck: DeckDetail; out?: DeckCard | null; into?: DeckCard | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

type In = { card: DeckCard } | { result: Schemas['CardSearchResult'] }
const outCard = ref<DeckCard | null>(null)
const inCard = ref<In | null>(null)
const outQuery = ref('')
const inQuery = ref('')
const busy = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) return
  outCard.value = props.out ?? null
  inCard.value = props.into ? { card: props.into } : null
  outQuery.value = ''
  inQuery.value = ''
})

const inName = computed(() => (inCard.value ? ('card' in inCard.value ? inCard.value.card.printing.name : inCard.value.result.name) : ''))
const inImage = computed(() => (inCard.value ? ('card' in inCard.value ? inCard.value.card.printing.image_normal : inCard.value.result.image_normal) : ''))
const inOracle = computed(() => (inCard.value ? ('card' in inCard.value ? inCard.value.card.printing.oracle_id : inCard.value.result.oracle_id) : null))
const matches = (card: DeckCard, q: string) => card.printing.name.toLowerCase().includes(q.trim().toLowerCase())

// Out: the deck's Commander, Mainboard and Sideboard cards.
const outOptions = computed(() =>
  props.deck.cards
    .filter((c) => c.zone !== 'maybe' && c.printing.oracle_id !== inOracle.value && matches(c, outQuery.value))
    .sort((a, b) => a.printing.name.localeCompare(b.printing.name)))
// In: the deck's Maybeboard cards first.
const maybeOptions = computed(() =>
  props.deck.cards
    .filter((c) => c.zone === 'maybe' && c.printing.oracle_id !== outCard.value?.printing.oracle_id && matches(c, inQuery.value))
    .sort((a, b) => a.printing.name.localeCompare(b.printing.name)))

function chooseResult(result: Schemas['CardSearchResult']) {
  // A card already in the Maybeboard pairs as that card.
  const existing = props.deck.cards.find((c) => c.zone === 'maybe' && c.printing.oracle_id === result.oracle_id)
  inCard.value = existing ? { card: existing } : { result }
}

async function propose() {
  if (!outCard.value || !inCard.value || busy.value) return
  busy.value = true
  let body: { out: number; card?: number; printing?: string }
  if ('card' in inCard.value) {
    body = { out: outCard.value.id, card: inCard.value.card.id }
  } else {
    // The newest printing, like adding a card (spec 004, AC-9).
    const { data: printings } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: inCard.value.result.oracle_id } } })
    const printing = printings?.[0]
    if (!printing) return (busy.value = false)
    body = { out: outCard.value.id, printing: printing.id }
  }
  const { data, error } = await api.POST('/api/decks/{id}/swaps/', { params: { path: { id: props.deck.id } }, body })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not propose the swap.')
  toast.success(`${inName.value} could replace ${outCard.value.printing.name}.`)
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl" data-testid="swap-dialog">
      <DialogHeader>
        <DialogTitle>Propose swap</DialogTitle>
        <DialogDescription class="sr-only">Pick a deck card to take out and a card to put in</DialogDescription>
      </DialogHeader>

      <section class="grid gap-2" data-testid="swap-out-field">
        <h3 class="text-sm font-medium">Out</h3>
        <div v-if="outCard" class="flex items-center gap-3 rounded-md border p-2" data-testid="swap-out-picked">
          <img :src="outCard.printing.image_small" alt="" class="h-14 rounded-sm" />
          <span class="flex-1 font-medium">{{ outCard.printing.name }}</span>
          <IconButton label="Change Out" variant="ghost" @click="outCard = null"><XIcon /></IconButton>
        </div>
        <template v-else>
          <Input v-model="outQuery" placeholder="Deck card" aria-label="Deck card" autocomplete="off" />
          <ul class="grid max-h-56 gap-1 overflow-y-auto" data-testid="swap-out-options">
            <li v-for="c in outOptions" :key="c.id">
              <CardPreview :image="c.printing.image_normal" :name="c.printing.name">
                <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left text-sm hover:bg-muted" :aria-label="c.printing.name" @click="outCard = c">
                  <img :src="c.printing.image_small" alt="" class="h-10 rounded-sm" loading="lazy" />
                  <span class="flex-1">{{ c.printing.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ ZONE_LABELS[c.zone as Zone] }}</span>
                </button>
              </CardPreview>
            </li>
            <li v-if="!outOptions.length" class="p-1.5 text-sm text-muted-foreground">No cards found.</li>
          </ul>
        </template>
      </section>

      <Separator />

      <section class="grid gap-2" data-testid="swap-in-field">
        <h3 class="text-sm font-medium">In</h3>
        <div v-if="inCard" class="flex items-center gap-3 rounded-md border p-2" data-testid="swap-in-picked">
          <img :src="inImage" alt="" class="h-14 rounded-sm" />
          <span class="flex-1 font-medium">{{ inName }}</span>
          <IconButton label="Change In" variant="ghost" @click="inCard = null"><XIcon /></IconButton>
        </div>
        <template v-else>
          <ul v-if="maybeOptions.length" class="grid gap-1" aria-label="Maybeboard" data-testid="swap-maybe-options">
            <li v-for="c in maybeOptions" :key="c.id">
              <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left text-sm hover:bg-muted" :aria-label="c.printing.name" @click="inCard = { card: c }">
                <img :src="c.printing.image_small" alt="" class="h-10 rounded-sm" loading="lazy" />
                <span class="flex-1">{{ c.printing.name }}</span>
                <span class="text-xs text-muted-foreground">Maybeboard</span>
              </button>
            </li>
          </ul>
          <CardSearch v-model:query="inQuery" @choose="chooseResult" />
        </template>
      </section>

      <DialogFooter>
        <Button :disabled="!outCard || !inCard || busy" @click="propose">Propose</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
