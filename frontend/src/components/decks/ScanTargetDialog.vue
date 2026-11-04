<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ScanTarget } from '@/lib/scanTarget'
import { useLocationsStore } from '@/stores/locations'

/** Where scanned cards go: a location (the deck box first), the cart, or the decklist only (spec 005, AC-16). */
const props = defineProps<{ deckId: number; boxId: number | null; current: ScanTarget | null; action?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [target: ScanTarget] }>()
const locations = useLocationsStore()

const kind = ref<ScanTarget['kind']>('location')
const location = ref('unfiled')
watch(open, (isOpen) => {
  if (!isOpen) return
  if (!locations.loaded) locations.load()
  const c = props.current
  kind.value = c?.kind ?? 'location'
  const preset = c?.kind === 'location' ? c.location : props.boxId
  location.value = preset === null ? 'unfiled' : String(preset)
})
const options = computed(() => [{ value: 'unfiled', label: 'Unfiled' }, ...locations.locations.map((l) => ({ value: String(l.id), label: l.name }))])

function confirm() {
  const target: ScanTarget = kind.value === 'cart' ? { kind: 'cart' }
    : kind.value === 'deck' ? { kind: 'deck', deck: props.deckId }
    : { kind: 'location', location: location.value === 'unfiled' ? null : Number(location.value) }
  open.value = false
  emit('confirm', target)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="text-foreground sm:max-w-md" data-testid="scan-target">
      <DialogHeader>
        <DialogTitle>Scan cards to</DialogTitle>
        <DialogDescription class="sr-only">Where scanned cards go</DialogDescription>
      </DialogHeader>
      <RadioGroup v-model="kind" class="grid gap-3">
        <div class="grid gap-2">
          <div class="flex items-center gap-2"><RadioGroupItem id="scan-to-location" value="location" /><Label for="scan-to-location" class="font-normal">A location</Label></div>
          <Select v-if="kind === 'location'" v-model="location">
            <SelectTrigger class="ml-6 w-64" aria-label="Location"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2"><RadioGroupItem id="scan-to-cart" value="cart" /><Label for="scan-to-cart" class="font-normal">The cart</Label></div>
        <div class="flex items-center gap-2"><RadioGroupItem id="scan-to-deck" value="deck" /><Label for="scan-to-deck" class="font-normal">The decklist only</Label></div>
      </RadioGroup>
      <DialogFooter><Button @click="confirm">{{ action ?? 'Scan' }}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
