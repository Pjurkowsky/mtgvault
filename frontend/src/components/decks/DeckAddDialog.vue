<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import PrintingPicker from '@/components/collection/PrintingPicker.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ZONE_LABELS, zonesFor, type DeckDetail, type Zone } from '@/lib/decks'

/** Search the catalog and add to a deck; stays open for the next card (spec 004, AC-10). */
const props = defineProps<{ deck: DeckDetail }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const ACTIVE = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

const query = ref('')
const results = ref<Schemas['CardSearchResult'][]>([])
const card = ref<Schemas['CardSearchResult'] | null>(null)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const quantity = ref(1)
const zone = ref<Zone>('main')
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  card.value = null
  quantity.value = 1
  zone.value = 'main'
})
let timer: ReturnType<typeof setTimeout>
watch(query, (q) => {
  clearTimeout(timer)
  card.value = null
  if (q.trim().length < 2) return (results.value = [])
  timer = setTimeout(async () => {
    const { data } = await api.GET('/api/catalog/cards/', { params: { query: { q } } })
    results.value = data ?? []
  }, 200)
})

async function choose(result: Schemas['CardSearchResult']) {
  card.value = result
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  printings.value = data ?? []
  printingId.value = printings.value[0]?.id ?? null
}

async function add() {
  if (!printingId.value || !card.value) return
  busy.value = true
  const { data, error } = await api.POST('/api/decks/{id}/cards/', {
    params: { path: { id: props.deck.id } },
    body: { printing: printingId.value, quantity: quantity.value, zone: zone.value },
  })
  busy.value = false
  if (error || !data) return toast.error(Object.values(fieldErrors(error)).join(' '))
  toast.success(`Added ${quantity.value} × ${card.value.name} to ${ZONE_LABELS[zone.value]}.`)
  emit('changed', data)
  query.value = ''
  quantity.value = 1
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Add to {{ deck.name }}</DialogTitle></DialogHeader>
      <Input v-model="query" placeholder="Card name" aria-label="Card name" autocomplete="off" autofocus />
      <ul v-if="!card && results.length" class="grid max-h-80 gap-1 overflow-y-auto" data-testid="card-results">
        <li v-for="r in results" :key="r.oracle_id">
          <CardPreview :image="r.image_normal" :name="r.name">
            <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted" :aria-label="r.name" @click="choose(r)">
              <img :src="r.image_small" alt="" class="h-12 rounded-sm" loading="lazy" />
              <span>{{ r.name }}</span>
            </button>
          </CardPreview>
        </li>
      </ul>
      <template v-if="card">
        <div class="flex items-center gap-2">
          <IconButton label="Back to results" variant="ghost" class="size-7" @click="card = null"><ArrowLeftIcon /></IconButton>
          <span class="font-medium">{{ card.name }}</span>
        </div>
        <PrintingPicker v-model="printingId" :printings="printings" />
        <div class="grid grid-cols-[6rem_1fr] items-center gap-3">
          <Label for="deck-add-qty">Quantity</Label>
          <Input id="deck-add-qty" v-model.number="quantity" type="number" min="1" max="999" class="w-24" />
          <Label id="deck-add-zone">Zone</Label>
          <ToggleGroup type="single" variant="outline" :model-value="zone" aria-labelledby="deck-add-zone" class="flex-wrap justify-start" @update:model-value="(v) => v && (zone = v as Zone)">
            <ToggleGroupItem v-for="z in zonesFor(deck.format)" :key="z" :value="z" :class="ACTIVE" class="px-3">{{ ZONE_LABELS[z] }}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </template>
      <DialogFooter>
        <Button :disabled="!card || busy" @click="add">Add</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
