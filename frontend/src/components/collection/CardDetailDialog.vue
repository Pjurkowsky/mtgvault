<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/composables/useConfirm'
import { CONDITIONS, FINISHES, LANGUAGES, labelOf } from '@/lib/cards'
import { cn } from '@/lib/utils'

/**
 * Card detail (spec 002, AC-24 to AC-38): big image, reprints, your copies,
 * and EDHREC tabs. Cards opened from a tab stack up; the back arrow returns.
 */
const props = defineProps<{ row: BrowserRow | null; currency: string; readonly?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: []; edit: [row: BrowserRow]; delete: [row: BrowserRow] }>()
const confirm = useConfirm()

type Entry = { oracleId: string; row: BrowserRow | null }
type EdhrecCard = Schemas['EdhrecCard'] & { share?: number }

const stack = ref<Entry[]>([])
const card = ref<Schemas['CardDetail'] | null>(null)
const edhrec = ref<Schemas['Edhrec'] | null>(null)
const loadingEdhrec = ref(false)
const tab = ref('commanders')

const current = computed(() => stack.value.at(-1) ?? null)
const row = computed(() => current.value?.row ?? null)
const ownRow = computed(() => !!row.value && !props.readonly)
const shown = computed(() => {
  const printings = card.value?.printings ?? []
  return printings.find((p) => p.id === row.value?.printing.id) ?? printings[0] ?? null
})

async function load() {
  const entry = current.value
  if (!entry) return
  card.value = null
  edhrec.value = null
  loadingEdhrec.value = true
  tab.value = 'commanders'
  const path = { params: { path: { oracle_id: entry.oracleId } } }
  const [detail, tabs] = await Promise.all([
    api.GET('/api/catalog/cards/{oracle_id}/', path),
    api.GET('/api/catalog/cards/{oracle_id}/edhrec/', path),
  ])
  if (current.value !== entry) return // the user moved on meanwhile
  card.value = detail.data ?? null
  edhrec.value = tabs.data ?? null
  loadingEdhrec.value = false
}

watch(open, (isOpen) => {
  if (!isOpen || !props.row) return
  stack.value = [{ oracleId: props.row.printing.oracle_id, row: props.row }]
  load()
})
// After an edit the browser hands us the saved row.
watch(() => props.row, (next) => {
  if (next && stack.value[0]) stack.value[0].row = next
})

function push(oracleId: string | null | undefined) {
  if (!oracleId) return
  stack.value.push({ oracleId, row: null })
  load()
}
function back() {
  stack.value.pop()
  load()
}

// Switch the row to another printing (AC-27).
async function switchTo(printing: Schemas['Printing']) {
  const r = row.value
  if (!ownRow.value || !r || printing.id === r.printing.id) return
  const copies = `${r.quantity} ${r.quantity === 1 ? 'copy' : 'copies'}`
  const ok = await confirm({
    title: `Switch to ${printing.set_name} #${printing.collector_number}?`,
    description: `Your ${copies} change to this printing.`,
    action: 'Switch',
    destructive: false,
  })
  if (!ok) return
  const { data, error } = await api.PATCH('/api/items/{id}/', { params: { path: { id: r.id } }, body: { printing: printing.id } })
  if (error || !data) return toast.error(Object.values(fieldErrors(error)).join(' '))
  toast.success(data.merged ? 'Switched. It matched another row, so the two merged.' : 'Switched printing.')
  stack.value[0].row = data.item as BrowserRow
  emit('changed')
}

const pct = (share?: number) => (share === undefined ? '' : `${Math.round(share * 100)}% of decks`)
const tabs = computed(() => [
  { value: 'commanders', label: 'Commanders' },
  { value: 'played_with', label: 'Played with' },
  { value: 'similar', label: 'Similar' },
])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="card-detail">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <IconButton v-if="stack.length > 1" label="Back" variant="ghost" class="size-7" @click="back"><ArrowLeftIcon /></IconButton>
          <DialogTitle>{{ shown?.name ?? card?.name ?? row?.printing.name }}</DialogTitle>
        </div>
        <DialogDescription v-if="shown">{{ shown.set_name }} #{{ shown.collector_number }}</DialogDescription>
      </DialogHeader>

      <div class="grid gap-6 md:grid-cols-[20rem_1fr]">
        <!-- Big image and reprints (AC-24, AC-26) -->
        <div class="grid content-start gap-3">
          <img
            v-if="shown" :src="shown.image_large || shown.image_normal" :alt="shown.name"
            class="w-full rounded-[4.75%/3.5%] bg-muted" data-testid="detail-image"
          />
          <Skeleton v-else class="aspect-[488/680] w-full" />
          <div v-if="card" class="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Reprints" data-testid="reprints">
            <component
              :is="ownRow ? 'button' : 'div'"
              v-for="p in card.printings" :key="p.id"
              :type="ownRow ? 'button' : undefined"
              role="radio" :aria-checked="p.id === shown?.id" :aria-label="`${p.set_name} #${p.collector_number}`"
              class="w-16 shrink-0 text-left"
              @click="switchTo(p)"
            >
              <img :src="p.image_small" alt="" loading="lazy" :class="cn('rounded-[4.75%/3.5%] bg-muted', p.id === shown?.id ? 'ring-2 ring-primary ring-offset-2' : ownRow && 'opacity-70 hover:opacity-100')" />
              <span class="mt-1 block truncate text-[10px] uppercase">{{ p.set_code }} #{{ p.collector_number }}</span>
            </component>
          </div>
        </div>

        <div class="grid content-start gap-6">
          <!-- Your copies (AC-25), or what you own of a card from a tab (AC-33, AC-34) -->
          <section v-if="row" class="grid gap-4" data-testid="copies">
            <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt class="text-muted-foreground">Quantity</dt><dd data-testid="detail-quantity">{{ row.quantity }}</dd></div>
              <div><dt class="text-muted-foreground">Finish</dt><dd>{{ labelOf(FINISHES, row.finish) }}</dd></div>
              <div><dt class="text-muted-foreground">Condition</dt><dd data-testid="detail-condition">{{ labelOf(CONDITIONS, row.condition) }}</dd></div>
              <div><dt class="text-muted-foreground">Language</dt><dd>{{ labelOf(LANGUAGES, row.language) }}</dd></div>
              <div v-if="!readonly"><dt class="text-muted-foreground">Location</dt><dd data-testid="detail-location">{{ row.location_name ?? 'Unfiled' }}</dd></div>
              <div><dt class="text-muted-foreground">Price</dt><dd data-testid="detail-price"><Price :value="row.unit_price" :values="row.unit_prices" :currency="currency" /></dd></div>
              <template v-if="!readonly">
                <div><dt class="text-muted-foreground">Price when added</dt><dd data-testid="detail-added-price"><Price :value="row.added_price" :values="row.added_prices" :currency="currency" /></dd></div>
                <div><dt class="text-muted-foreground">Purchase price</dt><dd data-testid="detail-purchase-price"><Price :value="row.purchase_prices?.[currency as 'USD'] ?? null" :values="row.purchase_prices" :currency="currency" /></dd></div>
              </template>
            </dl>
            <div v-if="!readonly" class="flex gap-2">
              <Button variant="outline" @click="emit('edit', row)">Edit</Button>
              <Button variant="outline" class="text-destructive" @click="emit('delete', row)">Delete</Button>
            </div>
          </section>
          <section v-else-if="card" class="flex flex-wrap items-center gap-3" data-testid="copies">
            <span class="text-sm" data-testid="owned">You own {{ card.owned }}</span>
            <Button disabled>Add</Button>
            <Button variant="outline" disabled>Add to want list</Button>
          </section>

          <!-- EDHREC tabs (AC-28 to AC-36) -->
          <Tabs v-model="tab">
            <TabsList>
              <TabsTrigger v-for="t in tabs" :key="t.value" :value="t.value">{{ t.label }}</TabsTrigger>
            </TabsList>
            <div v-if="loadingEdhrec" class="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
              <Skeleton v-for="n in 10" :key="n" class="aspect-[488/680] w-full" />
            </div>
            <p v-else-if="!edhrec?.available" class="mt-4 text-sm text-muted-foreground" data-testid="edhrec-empty">No EDHREC data</p>
            <template v-else>
              <TabsContent value="commanders" class="mt-4">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5" data-testid="edhrec-commanders">
                  <li v-for="c in edhrec.commanders" :key="c.name">
                    <CardPreview :image="c.image_normal" :name="c.name">
                      <button type="button" class="block w-full text-left disabled:cursor-default" :disabled="!c.oracle_id" :aria-label="c.name" data-testid="edhrec-card" @click="push(c.oracle_id)">
                        <img v-if="c.image_small" :src="c.image_small" :alt="c.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
                        <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ c.name }}</span>
                        <span class="mt-1 block text-xs text-muted-foreground">{{ pct((c as EdhrecCard).share) }}</span>
                      </button>
                    </CardPreview>
                  </li>
                </ul>
              </TabsContent>
              <TabsContent value="played_with" class="mt-4 grid gap-5" data-testid="edhrec-played-with">
                <section v-for="g in edhrec.played_with" :key="g.group" class="grid gap-2">
                  <h3 class="text-sm font-medium">{{ g.group }}</h3>
                  <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <li v-for="c in g.cards" :key="c.name">
                      <CardPreview :image="c.image_normal" :name="c.name">
                        <button type="button" class="block w-full text-left disabled:cursor-default" :disabled="!c.oracle_id" :aria-label="c.name" data-testid="edhrec-card" @click="push(c.oracle_id)">
                          <img v-if="c.image_small" :src="c.image_small" :alt="c.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
                          <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ c.name }}</span>
                        </button>
                      </CardPreview>
                    </li>
                  </ul>
                </section>
              </TabsContent>
              <TabsContent value="similar" class="mt-4">
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5" data-testid="edhrec-similar">
                  <li v-for="c in edhrec.similar" :key="c.name">
                    <CardPreview :image="c.image_normal" :name="c.name">
                      <button type="button" class="block w-full text-left disabled:cursor-default" :disabled="!c.oracle_id" :aria-label="c.name" data-testid="edhrec-card" @click="push(c.oracle_id)">
                        <img v-if="c.image_small" :src="c.image_small" :alt="c.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
                        <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ c.name }}</span>
                      </button>
                    </CardPreview>
                  </li>
                </ul>
              </TabsContent>
            </template>
          </Tabs>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
