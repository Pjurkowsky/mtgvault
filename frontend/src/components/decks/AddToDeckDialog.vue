<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Selection } from '@/composables/useSelection'
import { ZONE_LABELS, formatLabel, zonesFor, type Zone } from '@/lib/decks'

/** One copy of each selected card into a deck (spec 004, AC-10). */
const props = defineProps<{ selection: () => Selection }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const decks = ref<Schemas['DeckSummary'][]>([])
const deckId = ref<string>('')
const zone = ref<Zone>('main')
const busy = ref(false)
const deck = computed(() => decks.value.find((d) => String(d.id) === deckId.value))
const zones = computed(() => (deck.value ? zonesFor(deck.value.format) : (['main'] as Zone[])))

watch(open, async (isOpen) => {
  if (!isOpen) return
  zone.value = 'main'
  const { data } = await api.GET('/api/decks/')
  decks.value = data?.decks ?? []
  if (!deck.value) deckId.value = decks.value[0] ? String(decks.value[0].id) : ''
})
watch(zones, (list) => !list.includes(zone.value) && (zone.value = 'main'))

async function add() {
  if (!deck.value) return
  busy.value = true
  const { data } = await api.POST('/api/decks/add-from-collection/', {
    body: { deck: deck.value.id, zone: zone.value, selection: props.selection() as never },
  })
  busy.value = false
  if (!data) return toast.error('Could not add to the deck.')
  toast.success(`Added ${data.cards} ${data.cards === 1 ? 'card' : 'cards'} to ${deck.value.name}.`)
  open.value = false
  emit('done')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader><DialogTitle>Add to deck</DialogTitle></DialogHeader>
      <p v-if="!decks.length" class="text-sm text-muted-foreground">No decks yet.</p>
      <div v-else class="grid grid-cols-[5rem_1fr] items-center gap-3">
        <Label for="add-to-deck">Deck</Label>
        <Select v-model="deckId">
          <SelectTrigger id="add-to-deck" class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="d in decks" :key="d.id" :value="String(d.id)">{{ d.name }} · {{ formatLabel(d.format) }}</SelectItem>
          </SelectContent>
        </Select>
        <Label for="add-to-deck-zone">Zone</Label>
        <Select v-model="zone">
          <SelectTrigger id="add-to-deck-zone" class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="z in zones" :key="z" :value="z">{{ ZONE_LABELS[z] }}</SelectItem></SelectContent>
        </Select>
      </div>
      <DialogFooter><Button :disabled="!deck || busy" @click="add">Add</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
