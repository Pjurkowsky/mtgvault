<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { DeckDetail } from '@/lib/decks'

/** Delete a deck; a deck box needs a choice (spec 004, AC-6). */
const props = defineProps<{ deck: DeckDetail }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ deleted: [] }>()
const choice = ref<'keep' | 'unfile' | 'delete'>('keep')
const busy = ref(false)
watch(open, (isOpen) => isOpen && (choice.value = 'keep'))

async function confirm() {
  busy.value = true
  const { error } = await api.POST('/api/decks/{id}/delete/', {
    params: { path: { id: props.deck.id } }, body: props.deck.location ? { box: choice.value } : {},
  })
  busy.value = false
  if (error) return toast.error('Could not delete the deck.')
  toast.success(`Deleted ${props.deck.name}.`)
  open.value = false
  emit('deleted')
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {{ deck.name }}?</AlertDialogTitle>
        <AlertDialogDescription v-if="deck.location">Its deck box {{ deck.location_name }}:</AlertDialogDescription>
      </AlertDialogHeader>
      <RadioGroup v-if="deck.location" v-model="choice" class="grid gap-3">
        <div class="flex items-center gap-2"><RadioGroupItem id="box-keep" value="keep" /><Label for="box-keep" class="font-normal">Keep it as a normal location</Label></div>
        <div class="flex items-center gap-2"><RadioGroupItem id="box-unfile" value="unfile" /><Label for="box-unfile" class="font-normal">Move its cards to Unfiled</Label></div>
        <div class="flex items-center gap-2"><RadioGroupItem id="box-delete" value="delete" /><Label for="box-delete" class="font-normal">Delete its cards too</Label></div>
      </RadioGroup>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="busy" @click="confirm">Delete deck</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
