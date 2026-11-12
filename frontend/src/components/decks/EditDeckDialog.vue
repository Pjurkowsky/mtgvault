<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { onBranch, FORMATS, type DeckDetail } from '@/lib/decks'

/** Rename, change format or visibility (spec 004, AC-7). */
const props = defineProps<{ deck: DeckDetail }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()
const name = ref('')
const format = ref('')
const isPublic = ref(false)
const errors = ref<Record<string, string>>({})
watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.deck.name
  format.value = props.deck.format
  isPublic.value = props.deck.is_public
  errors.value = {}
})

async function save() {
  const { data, error } = await api.PATCH('/api/decks/{id}/', {
    params: { path: { id: props.deck.id }, query: onBranch(props.deck) }, body: { name: name.value, format: format.value as never, is_public: isPublic.value },
  })
  if (error || !data) return (errors.value = fieldErrors(error))
  toast.success('Saved.')
  open.value = false
  emit('changed', data)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader><DialogTitle>Edit deck</DialogTitle></DialogHeader>
      <form id="edit-deck" novalidate class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-2">
          <Label for="edit-deck-name">Name</Label>
          <Input id="edit-deck-name" v-model="name" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>
        <div class="grid gap-2">
          <Label for="edit-deck-format">Format</Label>
          <Select v-model="format">
            <SelectTrigger id="edit-deck-format" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem></SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2">
          <Switch id="edit-deck-public" v-model="isPublic" />
          <Label for="edit-deck-public" class="font-normal">Public</Label>
        </div>
      </form>
      <DialogFooter><Button type="submit" form="edit-deck">Save</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
