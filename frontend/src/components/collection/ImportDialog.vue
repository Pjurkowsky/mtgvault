<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CircleAlertIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import InfoTip from '@/components/InfoTip.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CONDITIONS, LANGUAGES } from '@/lib/cards'
import { CURRENCIES } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth'
import { useLocationsStore } from '@/stores/locations'

const props = defineProps<{ defaultLocation: number | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [] }>()
const auth = useAuthStore()
const locations = useLocationsStore()

const FORMAT_HELP = 'One card per line: 4 Lightning Bolt (2X2) 117 *F*. Only the name is required; *F* is foil, *E* etched.'

const text = ref('')
const location = ref('unfiled')
const condition = ref('NM')
const language = ref('en')
const price = ref('')
const priceCurrency = ref('USD')
const preview = ref<Schemas['ImportPreview'] | null>(null)
const busy = ref(false)

const body = computed(() => ({
  text: text.value,
  location: location.value === 'unfiled' ? null : Number(location.value),
  condition: condition.value as Schemas['ConditionEnum'],
  language: language.value as Schemas['LanguageEnum'],
  purchase_price: price.value === '' ? null : Number(price.value),
  purchase_currency: price.value === '' ? null : (priceCurrency.value as Schemas['CurrencyEnum']),
}))

watch(open, (isOpen) => {
  if (!isOpen) return
  text.value = ''
  preview.value = null
  location.value = props.defaultLocation === null ? 'unfiled' : String(props.defaultLocation)
  condition.value = 'NM'
  language.value = 'en'
  price.value = ''
  priceCurrency.value = auth.user?.currency ?? 'USD'
  if (!locations.loaded) locations.load()
})
watch(body, () => (preview.value = null), { deep: true })

async function readFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) text.value = await file.text()
}

async function runPreview() {
  busy.value = true
  const { data } = await api.POST('/api/imports/preview/', { body: body.value })
  busy.value = false
  preview.value = data ?? null
}

async function commit() {
  busy.value = true
  const { data, error } = await api.POST('/api/imports/commit/', { body: body.value })
  busy.value = false
  if (error || !data) return toast.error('Import failed. Nothing was saved.')
  toast.success(`Imported ${data.cards} ${data.cards === 1 ? 'card' : 'cards'}.`)
  open.value = false
  emit('imported')
}
</script>

<!-- Paste or upload, preview, then confirm (AC-45 to AC-49). -->
<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">Import <InfoTip :text="FORMAT_HELP" /></DialogTitle>
      </DialogHeader>

      <template v-if="!preview">
        <Textarea v-model="text" rows="10" class="font-mono text-xs" aria-label="Card list" placeholder="4 Lightning Bolt" />
        <Input type="file" accept=".txt,text/plain" aria-label="Upload .txt file" @change="readFile" />
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label for="import-location">Location</Label>
            <Select v-model="location">
              <SelectTrigger id="import-location" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unfiled">Unfiled</SelectItem>
                <SelectItem v-for="l in locations.locations" :key="l.id" :value="String(l.id)">{{ l.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="import-condition">Condition</Label>
            <Select v-model="condition">
              <SelectTrigger id="import-condition" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="import-language">Language</Label>
            <Select v-model="language">
              <SelectTrigger id="import-language" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="import-price">Purchase price per copy</Label>
            <div class="flex gap-1">
              <Input id="import-price" v-model="price" type="number" min="0" step="0.01" class="min-w-0" />
              <Select v-model="priceCurrency">
                <SelectTrigger class="w-20" aria-label="Purchase currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.value }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <Alert v-if="preview.errors.length" variant="destructive" data-testid="import-errors">
          <CircleAlertIcon />
          <AlertDescription>
            <ul class="grid gap-1">
              <li v-for="e in preview.errors" :key="e.line">
                Line {{ e.line }}: <span class="font-mono">{{ e.text }}</span> · {{ e.reason }}
              </li>
            </ul>
          </AlertDescription>
        </Alert>
        <ul class="grid max-h-80 gap-1 overflow-y-auto" data-testid="import-rows">
          <li v-for="r in preview.rows" :key="r.line" class="flex items-center gap-3 text-sm">
            <img :src="r.printing.image_small" alt="" class="h-10 rounded-sm" loading="lazy" />
            <span class="w-8 text-right tabular-nums">{{ r.quantity }}×</span>
            <span class="flex-1 truncate">{{ r.printing.name }}</span>
            <span class="text-muted-foreground uppercase">{{ r.printing.set_code }} #{{ r.printing.collector_number }}</span>
            <span v-if="r.finish !== 'nonfoil'" class="capitalize">{{ r.finish }}</span>
          </li>
        </ul>
      </template>

      <DialogFooter class="gap-2">
        <template v-if="!preview">
          <Button :disabled="busy || !text.trim()" @click="runPreview">Preview</Button>
        </template>
        <template v-else>
          <Button variant="outline" @click="preview = null">Back</Button>
          <Button :disabled="busy || !preview.rows.length" @click="commit">
            Import {{ preview.cards }} {{ preview.cards === 1 ? 'card' : 'cards' }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
