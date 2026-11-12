<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRightIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { onBranch, type DeckDetail } from '@/lib/decks'

type Change = Schemas['OptimizeChange']

/** Switch the cards this deck lacks to their cheapest printings (spec 013, AC-2 to AC-4). */
const props = defineProps<{ deck: DeckDetail; changes: Change[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

const ticked = ref<Set<number>>(new Set())
const busy = ref(false)
watch(open, (isOpen) => isOpen && (ticked.value = new Set(props.changes.map((c) => c.card))))

const GROUPS = [
  { state: 'missing', label: 'Missing' },
  { state: 'other_decks', label: 'In other decks' },
] as const
const groups = computed(() =>
  GROUPS.map((g) => ({ ...g, changes: props.changes.filter((c) => c.state === g.state) })).filter((g) => g.changes.length))

function toggle(card: number, on: boolean) {
  const next = new Set(ticked.value)
  if (on) next.add(card)
  else next.delete(card)
  ticked.value = next
}

// To buy after: the ticked cards' missing copies at the cheaper price (AC-3).
const toBuy = computed(() => Number(props.deck.stats.value.missing ?? 0))
const after = computed(() => props.changes.reduce(
  (sum, c) => (ticked.value.has(c.card) ? sum + (Number(c.cheapest_price) - Number(c.price ?? 0)) * c.copies : sum), toBuy.value))
const label = (p: Change['printing']) => `${p.set_code.toUpperCase()} #${p.collector_number}`

async function apply() {
  busy.value = true
  const cards = [...ticked.value]
  const { data, error } = await api.POST('/api/decks/{id}/optimize/', { params: { path: { id: props.deck.id }, query: onBranch(props.deck) }, body: { cards } })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not change the printings.')
  toast.success(`Changed ${cards.length} ${cards.length === 1 ? 'printing' : 'printings'}.`)
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl" data-testid="optimize-dialog">
      <DialogHeader>
        <DialogTitle>Optimize printings</DialogTitle>
        <DialogDescription class="sr-only">Switch cards you still need to their cheapest printings</DialogDescription>
      </DialogHeader>

      <section v-for="g in groups" :key="g.state" class="grid gap-1" :data-testid="`optimize-${g.state}`">
        <h3 class="border-b pb-1 text-sm font-medium">{{ g.label }}</h3>
        <label
          v-for="c in g.changes" :key="c.card" data-testid="optimize-row"
          class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded px-1 py-1.5 text-sm hover:bg-muted sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
        >
          <Checkbox :model-value="ticked.has(c.card)" :aria-label="c.name" @update:model-value="(v) => toggle(c.card, !!v)" />
          <span class="truncate font-medium">{{ c.name }}</span>
          <span class="col-start-2 flex items-center gap-1.5 text-xs text-muted-foreground sm:col-start-auto">
            <CardPreview :image="c.printing.image_normal" :name="c.name">
              <span class="uppercase" data-testid="optimize-from">{{ label(c.printing) }}</span>
            </CardPreview>
            <Price :value="c.price" :values="c.prices" :currency="deck.currency" />
            <ArrowRightIcon class="size-3" />
            <CardPreview :image="c.cheapest.image_normal" :name="c.name">
              <span class="uppercase text-foreground" data-testid="optimize-to">{{ label(c.cheapest) }}</span>
            </CardPreview>
            <Price :value="c.cheapest_price" :values="c.cheapest_prices" :currency="deck.currency" />
          </span>
          <span class="row-start-1 col-start-3 text-right text-xs tabular-nums text-emerald-600 sm:col-start-4 dark:text-emerald-400" data-testid="optimize-saving">
            <template v-if="c.saving !== null">−<Price :value="c.saving" :currency="deck.currency" /></template>
          </span>
        </label>
      </section>

      <dl class="grid grid-cols-2 gap-2 text-sm" data-testid="optimize-totals">
        <div><dt class="text-xs text-muted-foreground">To buy now</dt><dd class="font-semibold"><Price :value="toBuy" :currency="deck.currency" /></dd></div>
        <div><dt class="text-xs text-muted-foreground">After</dt><dd class="font-semibold" data-testid="optimize-after"><Price :value="after" :currency="deck.currency" /></dd></div>
      </dl>

      <DialogFooter>
        <Button :disabled="!ticked.size || busy" @click="apply">Apply</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
