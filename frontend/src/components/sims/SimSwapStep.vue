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
import { Separator } from '@/components/ui/separator'

/**
 * Cards Forge doesn't support, per deck, each with a stand-in. Swaps for a player's deck are only
 * for your simulations; a pool deck's swap changes the pool copy (spec 024, AC-11 to AC-13).
 */
const props = defineProps<{ checks: Schemas['SeatCheck'][] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const key = (seat: Schemas['SeatCheck'], name: string) => `${seat.source}-${seat.id}-${name}`
const swaps = ref<Record<string, string>>({})
const suggestions = ref<Record<string, Schemas['Suggestion'][]>>({})
const queries = ref<Record<string, string>>({})
const busy = ref(false)
// A deck seated twice is checked once.
const seats = computed(() => props.checks.filter((s, i) => s.unsupported.length && props.checks.findIndex((o) => o.source === s.source && o.id === s.id) === i))

watch(open, (isOpen) => {
  if (!isOpen) return
  swaps.value = {}
  for (const seat of seats.value) {
    for (const card of seat.unsupported) {
      if (card.swap) swaps.value[key(seat, card.name)] = card.swap
      const k = key(seat, card.name)
      api.GET('/api/sims/suggest/', { params: { query: { name: card.name, ...(seat.source === 'pool' ? { pool: seat.id } : { deck: seat.id }) } } })
        .then(({ data }) => (suggestions.value[k] = data ?? []))
    }
  }
}, { immediate: true })

const ready = computed(() => seats.value.every((s) => s.unsupported.every((c) => swaps.value[key(s, c.name)])))

async function save() {
  if (!ready.value || busy.value) return
  busy.value = true
  for (const seat of seats.value) {
    const body = {
      ...(seat.source === 'pool' ? { pool: seat.id } : { deck: seat.id }),
      swaps: seat.unsupported.map((c) => ({ from: c.name, to: swaps.value[key(seat, c.name)]! })),
    }
    const { error } = await api.PUT('/api/sims/swaps/', { body })
    if (error) {
      busy.value = false
      return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not save the swaps.')
    }
  }
  busy.value = false
  open.value = false
  emit('done')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl" data-testid="sim-swaps">
      <DialogHeader>
        <DialogTitle>Cards Forge can't play</DialogTitle>
        <DialogDescription>Pick a stand-in for each one. Your decks don't change; pool decks do.</DialogDescription>
      </DialogHeader>
      <template v-for="(seat, i) in seats" :key="`${seat.source}-${seat.id}`">
        <Separator v-if="i" />
        <section class="grid gap-3" :data-testid="`sim-swaps-${seat.label}`">
          <h3 class="text-sm font-semibold">{{ seat.label }}</h3>
          <div v-for="card in seat.unsupported" :key="card.name" class="grid gap-2" data-testid="unsupported-card">
            <div class="flex items-center gap-2 text-sm">
              <span class="font-medium">{{ card.name }}</span>
              <span class="text-muted-foreground">→</span>
              <span v-if="swaps[key(seat, card.name)]" class="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5" data-testid="swap-picked">
                {{ swaps[key(seat, card.name)] }}
                <IconButton label="Change stand-in" variant="ghost" size="icon-sm" @click="delete swaps[key(seat, card.name)]"><XIcon /></IconButton>
              </span>
              <span v-else class="text-muted-foreground">Pick a stand-in</span>
            </div>
            <template v-if="!swaps[key(seat, card.name)]">
              <ul v-if="suggestions[key(seat, card.name)]?.length" class="flex flex-wrap gap-2" data-testid="swap-suggestions">
                <li v-for="s in suggestions[key(seat, card.name)]" :key="s.name">
                  <CardPreview :image="s.image_normal" :name="s.name">
                    <Button size="sm" variant="outline" @click="swaps[key(seat, card.name)] = s.name">{{ s.name }}</Button>
                  </CardPreview>
                </li>
              </ul>
              <CardSearch
                :query="queries[key(seat, card.name)] ?? ''" @update:query="(q) => (queries[key(seat, card.name)] = q)"
                @choose="(r) => (swaps[key(seat, card.name)] = r.name)"
              />
            </template>
          </div>
        </section>
      </template>
      <DialogFooter>
        <Button :disabled="!ready || busy" @click="save">Save and run</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
