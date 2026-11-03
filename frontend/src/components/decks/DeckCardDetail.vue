<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import CardDetailDialog from '@/components/collection/CardDetailDialog.vue'
import EditItemDialog from '@/components/collection/EditItemDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { ZONE_LABELS, type DeckCard, type DeckDetail, type Zone } from '@/lib/decks'
import DeckSection from './DeckSection.vue'

/**
 * A deck card: the collection's card dialog with the deck section (spec 005, AC-3, AC-4).
 * Edits of your copies reuse the collection's edit and add dialogs.
 */
const props = defineProps<{ deck: DeckDetail; card: DeckCard | null; readonly?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const confirm = useConfirm()
const busy = ref(false)

async function refresh() {
  const { data } = await api.GET('/api/decks/{id}/', { params: { path: { id: props.deck.id } } })
  if (data) emit('changed', data)
}

function done(data: DeckDetail | undefined, error: unknown, message: string) {
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error)).join(' ') || 'Something went wrong.')
  toast.success(message)
  emit('changed', data)
  return data
}

const path = () => ({ params: { path: { id: props.deck.id, card_id: props.card!.id } } })

async function save(patch: { quantity: number; zone: Zone }) {
  busy.value = true
  const { data, error } = await api.PATCH('/api/decks/{id}/cards/{card_id}/', { ...path(), body: patch })
  if (done(data, error, 'Saved.')) open.value = false
}

async function choosePrinting(printing: Schemas['Printing']) {
  if (!props.card || printing.id === props.card.printing.id) return
  busy.value = true
  const { data, error } = await api.PATCH('/api/decks/{id}/cards/{card_id}/', { ...path(), body: { printing: printing.id } })
  done(data, error, `Shows ${printing.set_name} #${printing.collector_number}.`)
}

async function remove() {
  const card = props.card!
  const ok = await confirm({
    title: `Remove ${card.printing.name}?`, description: `From ${props.deck.name} (${ZONE_LABELS[card.zone as Zone]}).`, action: 'Remove',
  })
  if (!ok) return
  busy.value = true
  const { data, error } = await api.DELETE('/api/decks/{id}/cards/{card_id}/', path())
  if (done(data, error, `Removed ${card.printing.name}.`)) open.value = false
}

async function move(copy: Schemas['FreeCopy'], quantity: number) {
  busy.value = true
  const { data, error } = await api.POST('/api/decks/{id}/cards/{card_id}/own/', { ...path(), body: { item_id: copy.item_id, quantity } })
  done(data, error, 'Moved into the deck box.')
}

// Your copies: the collection's add and edit dialogs (AC-3, AC-4).
const addOpen = ref(false)
const editOpen = ref(false)
const editRow = ref<BrowserRow | null>(null)

async function editCopy(itemId: number) {
  const { data } = await api.GET('/api/items/{id}/', { params: { path: { id: itemId } } })
  if (!data) return toast.error('That copy is gone.')
  editRow.value = data as BrowserRow
  editOpen.value = true
}

async function deleteCopy(itemId: number) {
  const { data: row } = await api.GET('/api/items/{id}/', { params: { path: { id: itemId } } })
  if (!row) return
  const cards = `${row.quantity} ${row.quantity === 1 ? 'card' : 'cards'}`
  const ok = await confirm({ title: `Delete ${row.printing.name}?`, description: `This removes ${cards} from your collection.` })
  if (!ok) return
  const { error } = await api.DELETE('/api/items/{id}/', { params: { path: { id: itemId } } })
  if (error) return toast.error('Could not delete.')
  toast.success(`Deleted ${row.printing.name}.`)
  await refresh()
}
</script>

<template>
  <CardDetailDialog
    v-model:open="open" :row="null" :oracle-id="card?.printing.oracle_id" :printing-id="card?.printing.id"
    :currency="deck.currency" :readonly="readonly" choose-printing @choose-printing="choosePrinting"
  >
    <template v-if="card" #deck>
      <DeckSection
        :deck="deck" :card="card" :readonly="readonly" :busy="busy"
        @save="save" @remove="remove" @move="move" @add-copy="addOpen = true" @edit-copy="editCopy" @delete-copy="deleteCopy"
      />
    </template>
  </CardDetailDialog>
  <template v-if="!readonly && card">
    <AddCardDialog
      v-model:open="addOpen" :card="{ oracle_id: card.printing.oracle_id, name: card.printing.name }" :printing-id="card.printing.id"
      :default-location="deck.location ?? undefined" @added="refresh"
    />
    <EditItemDialog v-model:open="editOpen" :row="editRow" @saved="refresh" />
  </template>
</template>
