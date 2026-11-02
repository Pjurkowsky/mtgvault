<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FORMATS } from '@/lib/decks'
import ImportPreview from './ImportPreview.vue'

/** New deck, or (withImport) a deck created from a pasted list (spec 004, AC-2, AC-26). */
const props = defineProps<{ withImport?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const router = useRouter()

const name = ref('')
const format = ref('commander')
const isPublic = ref(false)
const createBox = ref(false)
const text = ref('')
const preview = ref<Schemas['DeckImportPreview'] | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  format.value = 'commander'
  isPublic.value = false
  createBox.value = false
  text.value = ''
  preview.value = null
  errors.value = {}
})
watch(text, () => (preview.value = null))

async function runPreview() {
  busy.value = true
  const { data } = await api.POST('/api/decks/import/preview/', { body: { text: text.value } })
  busy.value = false
  preview.value = data ?? null
}

async function create() {
  busy.value = true
  const { data, error } = await api.POST('/api/decks/', {
    body: { name: name.value, format: format.value as never, is_public: isPublic.value, create_box: createBox.value, text: props.withImport ? text.value : '' },
  })
  busy.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success(`Created ${data.name}.`)
  open.value = false
  router.push({ name: 'deck', params: { id: data.id } })
}

</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{{ withImport ? 'Import deck' : 'New deck' }}</DialogTitle></DialogHeader>
      <form id="new-deck" novalidate class="grid gap-4" @submit.prevent="withImport && !preview ? runPreview() : create()">
        <div class="grid gap-2">
          <Label for="deck-name">Name</Label>
          <Input id="deck-name" v-model="name" autocomplete="off" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>
        <div class="grid gap-2">
          <Label for="deck-format">Format</Label>
          <Select v-model="format">
            <SelectTrigger id="deck-format" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-wrap gap-6">
          <div class="flex items-center gap-2">
            <Switch id="deck-public" v-model="isPublic" />
            <Label for="deck-public" class="font-normal">Public</Label>
          </div>
          <div class="flex items-center gap-2">
            <Switch id="deck-box" v-model="createBox" />
            <Label for="deck-box" class="font-normal">Create deck box</Label>
          </div>
        </div>
        <template v-if="withImport">
          <Textarea v-model="text" rows="10" class="font-mono text-xs" aria-label="Decklist" placeholder="1 Sol Ring&#10;&#10;Sideboard&#10;2 Counterspell" />
          <ImportPreview v-if="preview" :preview="preview" />
        </template>
      </form>
      <DialogFooter>
        <Button v-if="withImport && !preview" type="submit" form="new-deck" :disabled="busy || !text.trim()">Preview</Button>
        <Button v-else type="submit" form="new-deck" :disabled="busy">{{ withImport ? `Create with ${preview?.cards ?? 0} cards` : 'Create' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
