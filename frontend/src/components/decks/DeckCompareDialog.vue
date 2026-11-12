<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRightIcon, ArrowRightIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import IconButton from '@/components/IconButton.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ZONE_LABELS, type Zone } from '@/lib/decks'

/**
 * Compare two lists of a deck (spec 027, AC-12, AC-13): any version of any branch,
 * or a branch's list now. Cards are matched by card and zone.
 */
const props = defineProps<{
  deckId: number
  username: string | null
  branches: Schemas['Branch'][]
  /** The sides it opens with: `branch:<id>` or `version:<id>`. */
  start: { a: string; b: string }
}>()
const open = defineModel<boolean>('open', { required: true })

const a = ref('')
const b = ref('')
watch(open, (isOpen) => {
  if (!isOpen) return
  a.value = props.start.a
  b.value = props.start.b
})
const swap = () => ([a.value, b.value] = [b.value, a.value])

const result = ref<Schemas['Compare'] | null>(null)
const loading = ref(false)
watch([a, b, open], async () => {
  if (!open.value || !a.value || !b.value) return
  loading.value = true
  const query = { a: a.value, b: b.value }
  const { data } = props.username
    ? await api.GET('/api/users/{username}/decks/{id}/compare/', { params: { path: { username: props.username, id: props.deckId }, query } })
    : await api.GET('/api/decks/{id}/compare/', { params: { path: { id: props.deckId }, query } })
  if (query.a !== a.value || query.b !== b.value) return
  result.value = data ?? null
  loading.value = false
})

const groups = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    { key: 'added', title: 'Added', cards: r.added },
    { key: 'removed', title: 'Removed', cards: r.removed },
    { key: 'changed', title: 'Quantity changed', cards: r.changed },
    { key: 'moved', title: 'Moved', cards: r.moved },
  ].filter((g) => g.cards.length)
})
const zone = (z: unknown) => ZONE_LABELS[z as Zone] ?? String(z)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="grid max-h-[90vh] grid-rows-[auto_auto_minmax(0,1fr)] sm:max-w-2xl" data-testid="compare-dialog">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-3">
          Compare
          <span v-if="result && groups.length" class="text-sm font-normal text-muted-foreground" data-testid="compare-totals">
            <span class="text-emerald-600">+{{ result.total_added }}</span> <span class="text-destructive">−{{ result.total_removed }}</span>
          </span>
        </DialogTitle>
      </DialogHeader>
      <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Select v-model="a">
          <SelectTrigger class="w-full" data-testid="compare-a"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup v-for="branch in branches" :key="branch.id">
              <SelectLabel>{{ branch.name }}</SelectLabel>
              <SelectItem :value="`branch:${branch.id}`">{{ branch.name }} (now)</SelectItem>
              <SelectItem v-for="v in branch.versions" :key="v.id" :value="`version:${v.id}`">
                {{ branch.name }} v{{ v.number }}<template v-if="v.name"> · {{ v.name }}</template>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <IconButton label="Swap sides" data-testid="compare-swap" @click="swap"><ArrowLeftRightIcon /></IconButton>
        <Select v-model="b">
          <SelectTrigger class="w-full" data-testid="compare-b"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup v-for="branch in branches" :key="branch.id">
              <SelectLabel>{{ branch.name }}</SelectLabel>
              <SelectItem :value="`branch:${branch.id}`">{{ branch.name }} (now)</SelectItem>
              <SelectItem v-for="v in branch.versions" :key="v.id" :value="`version:${v.id}`">
                {{ branch.name }} v{{ v.number }}<template v-if="v.name"> · {{ v.name }}</template>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div class="-mx-6 overflow-y-auto px-6">
        <div v-if="loading && !result" class="grid gap-2"><Skeleton class="h-24 w-full" /></div>
        <p v-else-if="result && !groups.length" class="py-10 text-center text-muted-foreground">No changes</p>
        <div v-else class="grid gap-5 pb-1" :class="loading && 'opacity-60'">
          <section v-for="g in groups" :key="g.key" class="grid gap-2" :data-testid="`compare-${g.key}`">
            <h3 class="text-sm font-medium">{{ g.title }} <span class="text-muted-foreground">{{ g.cards.length }}</span></h3>
            <ul class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
              <li v-for="c in g.cards" :key="`${c.printing.oracle_id}-${c.zone}-${c.from_zone}`" class="grid content-start gap-1 text-xs" data-testid="compare-card">
                <CardPreview :image="c.printing.image_normal" :name="c.printing.name">
                  <img :src="c.printing.image_small" :alt="c.printing.name" class="w-full rounded-[4.75%/3.5%] bg-muted" loading="lazy" />
                </CardPreview>
                <span class="truncate font-medium" :title="c.printing.name">{{ c.printing.name }}</span>
                <span class="flex flex-wrap items-center gap-1 text-muted-foreground">
                  <template v-if="g.key === 'changed'">{{ c.from_quantity }} <ArrowRightIcon class="size-3" /> {{ c.quantity }}</template>
                  <template v-else-if="g.key === 'moved'">{{ c.quantity }} × {{ zone(c.from_zone) }} <ArrowRightIcon class="size-3" /> {{ zone(c.zone) }}</template>
                  <template v-else>{{ g.key === 'added' ? '+' : '−' }}{{ c.quantity }} · {{ zone(c.zone) }}</template>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
