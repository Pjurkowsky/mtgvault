<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import PrintingPicker from '@/components/collection/PrintingPicker.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useConfirm } from '@/composables/useConfirm'
import { ZONE_LABELS, zonesFor, type DeckCard, type DeckDetail, type Zone } from '@/lib/decks'
import OwnershipBadge from './OwnershipBadge.vue'

/** A deck card's actions (spec 004, AC-11, AC-15, AC-20). */
const props = defineProps<{ deck: DeckDetail; card: DeckCard | null; readonly?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const confirm = useConfirm()

const quantity = ref(1)
const zone = ref<Zone>('main')
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const busy = ref(false)
const ACTIVE = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

watch(open, async (isOpen) => {
  const card = props.card
  if (!isOpen || !card) return
  quantity.value = card.quantity
  zone.value = card.zone as Zone
  printingId.value = card.printing.id
  printings.value = []
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: card.printing.oracle_id } } })
  printings.value = data ?? []
})

const own = computed(() => props.card?.ownership)
const short = computed(() => (own.value ? Math.max(0, own.value.needed - own.value.in_box) : 0))

async function done(data: DeckDetail | undefined, error: unknown, message: string) {
  busy.value = false
  if (error || !data) return toast.error(Object.values(fieldErrors(error)).join(' ') || 'Something went wrong.')
  toast.success(message)
  emit('changed', data)
}

async function save() {
  if (!props.card) return
  busy.value = true
  const { data, error } = await api.PATCH('/api/decks/{id}/cards/{card_id}/', {
    params: { path: { id: props.deck.id, card_id: props.card.id } },
    body: { quantity: quantity.value, zone: zone.value, printing: printingId.value ?? undefined },
  })
  await done(data, error, 'Saved.')
  if (data) open.value = false
}

async function remove() {
  if (!props.card) return
  if (!(await confirm({ title: `Remove ${props.card.printing.name}?`, description: `From ${props.deck.name} (${ZONE_LABELS[props.card.zone as Zone]}).`, action: 'Remove' }))) return
  busy.value = true
  const { data, error } = await api.DELETE('/api/decks/{id}/cards/{card_id}/', { params: { path: { id: props.deck.id, card_id: props.card.id } } })
  await done(data, error, `Removed ${props.card.printing.name}.`)
  if (data) open.value = false
}

async function markOwned(body: Schemas['MarkOwned']) {
  if (!props.card) return
  busy.value = true
  const { data, error } = await api.POST('/api/decks/{id}/cards/{card_id}/own/', {
    params: { path: { id: props.deck.id, card_id: props.card.id } }, body,
  })
  await done(data, error, body.item_id ? 'Moved into the deck box.' : props.deck.location ? 'Added a copy to the deck box.' : 'Added a copy to Unfiled.')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="card" class="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="deck-card-dialog" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle>{{ card.printing.name }}</DialogTitle>
        <DialogDescription>{{ card.printing.set_name }} #{{ card.printing.collector_number }} · <Price :value="card.price" :values="card.prices" :currency="deck.currency" /></DialogDescription>
      </DialogHeader>
      <div class="grid gap-5 sm:grid-cols-[12rem_1fr]">
        <img :src="card.printing.image_normal" :alt="card.printing.name" class="w-full rounded-[4.75%/3.5%] bg-muted" />
        <div class="grid content-start gap-4">
          <!-- Ownership (AC-13, AC-15) -->
          <section class="grid gap-2" data-testid="deck-card-ownership">
            <OwnershipBadge :card="card" show-label />
            <ul class="grid gap-1 text-sm">
              <li v-if="card.ownership.in_box">{{ card.ownership.in_box }} in the deck box</li>
              <li v-for="f in card.ownership.free_copies" :key="f.item_id" class="flex items-center justify-between gap-2">
                <span>{{ f.quantity }} in {{ f.location }} <span class="text-muted-foreground uppercase">({{ f.set_code }} #{{ f.collector_number }})</span></span>
                <Button
                  v-if="!readonly && deck.location && short > 0" size="sm" variant="outline" :disabled="busy"
                  @click="markOwned({ item_id: f.item_id, quantity: Math.min(short, f.quantity) })"
                >Move to deck box</Button>
              </li>
              <li v-for="d in card.ownership.other_decks" :key="d.deck">{{ d.quantity }} in deck {{ d.deck }}</li>
              <li v-if="card.ownership.missing" class="text-destructive">{{ card.ownership.missing }} missing</li>
            </ul>
            <Button
              v-if="!readonly && card.ownership.state !== 'in_box'" size="sm" variant="outline" class="justify-self-start" :disabled="busy"
              @click="markOwned({ quantity: 1, new: {} })"
            >Add a new copy{{ deck.location ? ' to the deck box' : '' }}</Button>
          </section>

          <template v-if="!readonly">
            <Separator />
            <div class="grid grid-cols-[6rem_1fr] items-center gap-3">
              <Label for="deck-card-qty">Quantity</Label>
              <Input id="deck-card-qty" v-model.number="quantity" type="number" min="1" max="999" class="w-24" />
              <Label id="deck-card-zone">Zone</Label>
              <ToggleGroup type="single" variant="outline" :model-value="zone" aria-labelledby="deck-card-zone" class="flex-wrap justify-start" @update:model-value="(v) => v && (zone = v as Zone)">
                <ToggleGroupItem v-for="z in zonesFor(deck.format)" :key="z" :value="z" :class="ACTIVE" class="px-3">{{ ZONE_LABELS[z] }}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <PrintingPicker v-if="printings.length > 1" v-model="printingId" :printings="printings" />
            <div class="flex justify-between gap-2">
              <Button variant="ghost" class="text-destructive" :disabled="busy" @click="remove">Remove</Button>
              <Button :disabled="busy" @click="save">Save</Button>
            </div>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
