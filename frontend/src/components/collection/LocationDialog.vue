<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { fieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { KINDS, type LocationKind } from '@/lib/cards'
import { FORMATS } from '@/lib/decks'
import { useLocationsStore, type Location } from '@/stores/locations'

const props = defineProps<{ location?: Location | null }>()
const open = defineModel<boolean>('open', { required: true })
const store = useLocationsStore()

const name = ref('')
const kind = ref<LocationKind>('binder')
const isPublic = ref(false)
// A Deck box's deck format (spec 005, AC-18).
const deckFormat = ref<string>('commander')
const errors = ref<Record<string, string>>({})
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.location?.name ?? ''
  kind.value = props.location?.kind ?? 'binder'
  isPublic.value = props.location?.is_public ?? false
  deckFormat.value = props.location?.deck_format ?? 'commander'
  errors.value = {}
})

async function save() {
  saving.value = true
  const body = {
    name: name.value, kind: kind.value, is_public: isPublic.value,
    ...(kind.value === 'deck_box' ? { deck_format: deckFormat.value as Location['deck_format'] } : {}),
  }
  const { error } = props.location ? await store.update(props.location.id, body) : await store.create(body)
  saving.value = false
  if (error) return (errors.value = fieldErrors(error))
  toast.success(props.location ? 'Location saved.' : `Created ${body.name}.`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ location ? 'Edit location' : 'New location' }}</DialogTitle>
      </DialogHeader>
      <form id="location-form" novalidate class="grid gap-5" @submit.prevent="save">
        <div class="grid gap-2">
          <Label for="location-name">Name</Label>
          <Input id="location-name" v-model="name" autocomplete="off" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>
        <div class="grid gap-2">
          <Label id="location-kind">Kind</Label>
          <RadioGroup v-model="kind" aria-labelledby="location-kind" class="flex gap-4">
            <div v-for="k in KINDS" :key="k.value" class="flex items-center gap-2">
              <RadioGroupItem :id="`kind-${k.value}`" :value="k.value" />
              <Label :for="`kind-${k.value}`" class="font-normal">{{ k.label }}</Label>
            </div>
          </RadioGroup>
        </div>
        <div v-if="kind === 'deck_box'" class="grid gap-2">
          <Label for="location-format">Format</Label>
          <Select v-model="deckFormat">
            <SelectTrigger id="location-format" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem></SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-3">
          <Switch id="location-public" v-model="isPublic" />
          <Label for="location-public" class="font-normal">Public</Label>
        </div>
      </form>
      <DialogFooter>
        <Button type="submit" form="location-form" :disabled="saving">{{ location ? 'Save' : 'Create' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
