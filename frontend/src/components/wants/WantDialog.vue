<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import CardSearch from '@/components/collection/CardSearch.vue'
import PrintingPicker from '@/components/collection/PrintingPicker.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WantRow } from '@/components/browser/types'
import { FINISHES } from '@/lib/cards'

type Picked = { oracle_id: string; name: string }
type WantFinish = Schemas['WantFinishEnum']

/** Add a card to the want list, or edit an entry (spec 010, AC-9, AC-11). */
const props = defineProps<{ entry?: WantRow | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const query = ref('')
const card = ref<Picked | null>(null)
const printings = ref<Schemas['Printing'][]>([])
const printingId = ref<string | null>(null)
const anyPrinting = ref(true)
const finish = ref<WantFinish>('any')
const quantity = ref(1)
const deck = ref('none')
const decks = ref<Schemas['DeckSummary'][]>([])
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const search = ref<InstanceType<typeof CardSearch> | null>(null)

const editing = computed(() => !!props.entry)
const printing = computed(() => printings.value.find((p) => p.id === printingId.value) ?? null)
// A pinned printing offers only its own finishes.
const finishes = computed(() => (anyPrinting.value || !printing.value
  ? FINISHES : FINISHES.filter((f) => printing.value!.finishes.includes(f.value))))

watch(open, async (isOpen) => {
  if (!isOpen) return
  errors.value = {}
  query.value = ''
  card.value = null
  printings.value = []
  const e = props.entry
  anyPrinting.value = e?.any_printing ?? true
  finish.value = e?.finish ?? 'any'
  quantity.value = e?.quantity ?? 1
  deck.value = e?.deck ? String(e.deck) : 'none'
  api.GET('/api/decks/').then(({ data }) => (decks.value = data?.decks ?? []))
  if (e) await choose({ oracle_id: e.printing.oracle_id, name: e.printing.name }, e.printing.id)
})
watch(query, () => !editing.value && (card.value = null))
watch(finishes, (list) => {
  if (finish.value !== 'any' && !list.some((f) => f.value === finish.value)) finish.value = 'any'
})

async function choose(result: Picked, preselect?: string | null) {
  card.value = result
  const { data } = await api.GET('/api/catalog/cards/{oracle_id}/printings/', { params: { path: { oracle_id: result.oracle_id } } })
  printings.value = data ?? []
  printingId.value = printings.value.find((p) => p.id === preselect)?.id ?? printings.value[0]?.id ?? null
}

async function save() {
  if (!printing.value) return
  saving.value = true
  errors.value = {}
  const body = {
    printing: printing.value.id, any_printing: anyPrinting.value, finish: finish.value,
    quantity: quantity.value, deck: deck.value === 'none' ? null : Number(deck.value),
  }
  const { data, error } = props.entry
    ? await api.PATCH('/api/wants/{id}/', { params: { path: { id: props.entry.id } }, body })
    : await api.POST('/api/wants/', { body })
  saving.value = false
  if (error || !data) return (errors.value = fieldErrors(error))
  const merged = data.merged ? ' It matched another entry, so the two merged.' : ''
  toast.success(editing.value ? `Saved.${merged}` : `Added ${quantity.value} × ${data.want.printing.name} to the want list.${merged}`)
  emit('saved')
  if (editing.value) return (open.value = false)
  query.value = ''
  card.value = null
  quantity.value = 1
  await nextTick()
  search.value?.focus()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="want-dialog">
      <DialogHeader>
        <DialogTitle>{{ editing ? `Edit ${entry?.printing.name}` : 'Add to want list' }}</DialogTitle>
      </DialogHeader>

      <CardSearch v-if="!editing" ref="search" v-model:query="query" :picked="!!card" @choose="choose" />

      <template v-if="card">
        <div v-if="!editing" class="flex items-center gap-2">
          <IconButton label="Back to results" variant="ghost" class="size-7" @click="card = null"><ArrowLeftIcon /></IconButton>
          <span class="font-medium">{{ card.name }}</span>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="anyPrinting" aria-label="Any printing" /> Any printing
        </label>
        <PrintingPicker v-model="printingId" :printings="printings" :sync-finish="!editing" @finish="(f) => (finish = f)" />
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="grid gap-2">
            <Label for="want-quantity">Quantity</Label>
            <Input id="want-quantity" v-model.number="quantity" type="number" min="1" max="999" />
            <p v-if="errors.quantity" class="text-sm text-destructive">{{ errors.quantity }}</p>
          </div>
          <div class="grid gap-2">
            <Label>Finish</Label>
            <Select v-model="finish">
              <SelectTrigger aria-label="Finish" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem v-for="f in finishes" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.finish" class="text-sm text-destructive">{{ errors.finish }}</p>
          </div>
          <div class="grid gap-2">
            <Label>Deck</Label>
            <Select v-model="deck">
              <SelectTrigger aria-label="Deck" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem v-for="d in decks" :key="d.id" :value="String(d.id)">{{ d.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </template>

      <DialogFooter>
        <Button :disabled="!printing || saving" @click="save">{{ editing ? 'Save' : 'Add' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
