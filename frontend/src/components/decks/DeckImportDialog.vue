<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { DeckDetail } from '@/lib/decks'
import ImportPreview from './ImportPreview.vue'

/** Add a pasted list to a deck after a preview (spec 004, AC-25, AC-26). */
const props = defineProps<{ deck: DeckDetail }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const text = ref('')
const preview = ref<Schemas['DeckImportPreview'] | null>(null)
const busy = ref(false)
watch(open, (isOpen) => isOpen && ((text.value = ''), (preview.value = null)))
watch(text, () => (preview.value = null))

async function next() {
  busy.value = true
  if (!preview.value) {
    const { data } = await api.POST('/api/decks/import/preview/', { body: { text: text.value } })
    preview.value = data ?? null
    busy.value = false
    return
  }
  const { data } = await api.POST('/api/decks/{id}/import/', { params: { path: { id: props.deck.id } }, body: { text: text.value } })
  busy.value = false
  if (!data) return toast.error('Could not import.')
  toast.success(`Added ${preview.value.cards} cards.`)
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Import into {{ deck.name }}</DialogTitle></DialogHeader>
      <Textarea v-model="text" rows="10" class="font-mono text-xs" aria-label="Decklist" placeholder="1 Sol Ring&#10;&#10;Sideboard&#10;2 Counterspell" />
      <ImportPreview v-if="preview" :preview="preview" />
      <DialogFooter>
        <Button :disabled="busy || !text.trim() || (!!preview && !preview.cards)" @click="next">
          {{ preview ? `Add ${preview.cards} cards` : 'Preview' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
