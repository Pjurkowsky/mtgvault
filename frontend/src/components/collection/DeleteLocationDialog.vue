<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLocationsStore, type Location } from '@/stores/locations'

const props = defineProps<{ location: Location | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ deleted: [] }>()
const store = useLocationsStore()

const choice = ref<'unfile' | 'move' | 'delete'>('unfile')
const target = ref<string>('')
const busy = ref(false)

const others = computed(() => store.locations.filter((l) => l.id !== props.location?.id))
const count = computed(() => props.location?.card_count ?? 0)
const cardsText = computed(() => `${count.value} ${count.value === 1 ? 'card' : 'cards'}`)

watch(open, (isOpen) => {
  if (isOpen) {
    choice.value = 'unfile'
    target.value = ''
  }
})

async function confirm() {
  if (!props.location) return
  if (count.value && choice.value === 'move' && !target.value) return toast.error('Choose a location.')
  busy.value = true
  const body = count.value
    ? { cards: choice.value, ...(choice.value === 'move' ? { target: Number(target.value) } : {}) }
    : {}
  const { error } = await store.remove(props.location.id, body)
  busy.value = false
  if (error) return toast.error('Could not delete the location.')
  toast.success(`Deleted ${props.location.name}.`)
  open.value = false
  emit('deleted')
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {{ location?.name }}?</AlertDialogTitle>
        <AlertDialogDescription v-if="count">It holds {{ cardsText }}.</AlertDialogDescription>
      </AlertDialogHeader>

      <RadioGroup v-if="count" v-model="choice" class="grid gap-3">
        <div class="flex items-center gap-2">
          <RadioGroupItem id="cards-unfile" value="unfile" />
          <Label for="cards-unfile" class="font-normal">Make them Unfiled</Label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <RadioGroupItem id="cards-move" value="move" :disabled="!others.length" />
          <Label for="cards-move" class="font-normal">Move them to</Label>
          <Select v-model="target" :disabled="choice !== 'move'">
            <SelectTrigger class="h-8 w-48" aria-label="Target location"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="l in others" :key="l.id" :value="String(l.id)">{{ l.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroupItem id="cards-delete" value="delete" />
          <Label for="cards-delete" class="font-normal">Delete them too</Label>
        </div>
      </RadioGroup>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button variant="destructive" :disabled="busy" @click="confirm">Delete location</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
