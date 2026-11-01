<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  DownloadIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SquareCheckIcon,
  UploadIcon,
} from '@lucide/vue'
import { api } from '@/api/client'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import CardDetailDialog from '@/components/collection/CardDetailDialog.vue'
import ImportDialog from '@/components/collection/ImportDialog.vue'
import InfoTip from '@/components/InfoTip.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBrowserQuery, type View } from '@/composables/useBrowserQuery'
import { useInfiniteItems, type Page } from '@/composables/useInfiniteItems'
import { useSelection } from '@/composables/useSelection'
import { SORTS } from '@/lib/cards'
import { formatMoney, PLN_ESTIMATE } from '@/lib/money'
import BulkDialog, { type BulkAction } from './BulkDialog.vue'
import CardGrid from './CardGrid.vue'
import CardTable from './CardTable.vue'
import ExportDialog from './ExportDialog.vue'
import FilterChips from './FilterChips.vue'
import FilterPopover from './FilterPopover.vue'
import type { BrowserRow, BrowserSource } from './types'

/**
 * The one card browser (principle P-2): All cards, location pages and public
 * location pages all use it, so search, filters, sort, view and selection
 * behave the same everywhere.
 */
const props = defineProps<{
  source: BrowserSource
  /** Fixed location: an id, or 'unfiled'. Omit for all cards. */
  location?: string
  readonly?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const { filter, view, update, setView, clearFilters, activeFilterCount } = useBrowserQuery()
const selection = useSelection()
const editable = computed(() => props.source.kind === 'own' && !props.readonly)
const defaultLocation = computed(() => (props.location && props.location !== 'unfiled' ? Number(props.location) : null))

// ----- data -----
const query = computed(() => ({ ...filter.value, ...(props.location ? { location: props.location } : {}) }))

async function fetchPage(offset: number, limit: number): Promise<Page<BrowserRow> | undefined> {
  const pageQuery = { ...query.value, offset: String(offset), limit: String(limit) }
  if (props.source.kind === 'own') {
    return (await api.GET('/api/items/', { params: { query: pageQuery } })).data
  }
  const { username, locationId } = props.source
  return (await api.GET('/api/users/{username}/locations/{id}/items/', {
    params: { path: { username, id: locationId }, query: pageQuery },
  })).data
}
const { rows, page, loading, done, loadMore, reload } = useInfiniteItems<BrowserRow>(fetchPage, query)
const currency = computed(() => page.value?.currency ?? 'USD')

function refresh() {
  reload()
  emit('changed')
}

// Load more when the sentinel scrolls into view.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
onMounted(() => {
  observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())

// ----- search (debounced into the URL) -----
const search = ref(filter.value.q ?? '')
watch(() => filter.value.q, (q) => {
  if ((q ?? '') !== search.value) search.value = q ?? ''
})
let searchTimer: ReturnType<typeof setTimeout>
watch(search, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => update({ q: q.trim() || undefined }), 250)
})

// ----- clicks: open the card, or select in selection mode -----
const detailRow = ref<BrowserRow | null>(null)
const detailOpen = ref(false)
let lastIndex: number | null = null

function onCardClick(row: BrowserRow, index: number, event: MouseEvent) {
  if (!selection.active.value) {
    detailRow.value = row
    detailOpen.value = true
    return
  }
  if (event.shiftKey && lastIndex !== null) {
    // Range: give every card between the last click and this one the new state.
    const state = !selection.isSelected(row.id)
    const [from, to] = [Math.min(lastIndex, index), Math.max(lastIndex, index)]
    rows.value.slice(from, to + 1).forEach((r) => selection.set(r.id, state))
  } else {
    selection.toggle(row.id)
  }
  lastIndex = index
}

function toggleSelecting() {
  if (selection.active.value) selection.stop()
  else selection.active.value = true
  lastIndex = null
}

// ----- dialogs -----
const addOpen = ref(false)
const importOpen = ref(false)
const exportOpen = ref(false)
const exportSelection = ref(false)
const bulkOpen = ref(false)
const bulkAction = ref<BulkAction | null>(null)

function openBulk(action: BulkAction) {
  bulkAction.value = action
  bulkOpen.value = true
}

function openExport(onlySelection: boolean) {
  exportSelection.value = onlySelection
  exportOpen.value = true
}

async function loadExport() {
  if (props.source.kind === 'public') {
    const { username, locationId } = props.source
    const { data } = await api.POST('/api/users/{username}/locations/{id}/export/', {
      params: { path: { username, id: locationId } },
      body: { filter: query.value as never },
    })
    return data
  }
  const selected = exportSelection.value ? selection.toSelection() : { filter: query.value, exclude_ids: [] }
  const { data } = await api.POST('/api/items/export/', { body: { selection: selected as never } })
  return data
}

function afterBulk() {
  selection.stop()
  refresh()
}

const pricesUpdated = computed(() => {
  const at = page.value?.prices_updated_at
  return at ? new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
})
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
</script>

<template>
  <div class="grid gap-4 pb-20">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" placeholder="Search" aria-label="Search cards" class="pl-8" type="search" />
      </div>
      <FilterPopover :filter="filter" :active-count="activeFilterCount" :currency="currency" @update="update" />
      <Select :model-value="filter.sort" @update:model-value="(v) => update({ sort: String(v) })">
        <SelectTrigger class="w-36" aria-label="Sort by"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline" size="icon"
        :aria-label="filter.dir === 'asc' ? 'Ascending' : 'Descending'"
        @click="update({ dir: filter.dir === 'asc' ? 'desc' : 'asc' })"
      >
        <ArrowUpNarrowWideIcon v-if="filter.dir === 'asc'" />
        <ArrowDownWideNarrowIcon v-else />
      </Button>
      <ToggleGroup type="single" variant="outline" :model-value="view" @update:model-value="(v) => v && setView(v as View)">
        <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGridIcon /></ToggleGroupItem>
        <ToggleGroupItem value="table" aria-label="Table view"><ListIcon /></ToggleGroupItem>
      </ToggleGroup>

      <div class="ml-auto flex flex-wrap gap-2">
        <Button v-if="editable" :variant="selection.active.value ? 'secondary' : 'outline'" @click="toggleSelecting">
          <SquareCheckIcon /> Select
        </Button>
        <Button variant="outline" @click="openExport(false)"><DownloadIcon /> Export</Button>
        <template v-if="editable">
          <Button variant="outline" @click="importOpen = true"><UploadIcon /> Import</Button>
          <Button @click="addOpen = true"><PlusIcon /> Add card</Button>
        </template>
      </div>
    </div>

    <FilterChips :filter="filter" :currency="currency" @update="update" @clear="clearFilters" />

    <div v-if="page" class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p data-testid="browser-summary">
        {{ plural(page.count, 'row') }} · {{ plural(page.total_quantity, 'card') }} · {{ formatMoney(page.total_value, currency) }}
        <InfoTip v-if="currency === 'PLN'" :text="PLN_ESTIMATE" class="ml-1 align-middle" />
      </p>
      <p v-if="pricesUpdated" data-testid="prices-updated">Prices updated {{ pricesUpdated }}</p>
    </div>

    <!-- Results -->
    <CardGrid
      v-if="view === 'grid' && rows.length"
      :rows="rows" :currency="currency" :selecting="selection.active.value" :is-selected="selection.isSelected"
      @open="onCardClick"
    />
    <CardTable
      v-else-if="rows.length"
      :rows="rows" :currency="currency" :selecting="selection.active.value" :is-selected="selection.isSelected"
      :show-location="source.kind === 'own' && !location"
      @open="onCardClick"
    />
    <p v-else-if="!loading && page" class="py-16 text-center text-muted-foreground" data-testid="browser-empty">
      {{ activeFilterCount || filter.q ? 'No cards match.' : 'No cards yet.' }}
    </p>
    <div v-if="loading && !rows.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <Skeleton v-for="n in 10" :key="n" class="aspect-[488/680] w-full" />
    </div>
    <div ref="sentinel" aria-hidden="true" />
    <p v-if="loading && rows.length" class="text-center text-sm text-muted-foreground">Loading…</p>
    <p v-else-if="done && rows.length > 60" class="text-center text-sm text-muted-foreground">End of list</p>

    <!-- Selection bar (AC-38 to AC-41) -->
    <div
      v-if="selection.active.value"
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))"
      data-testid="selection-bar"
    >
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span class="mr-2 font-medium" data-testid="selected-count">{{ selection.count.value }} selected</span>
        <Button variant="ghost" size="sm" :disabled="!page?.count" @click="selection.selectAll(query, page?.count ?? 0)">
          Select all {{ page?.count ?? '' }}
        </Button>
        <Button variant="ghost" size="sm" :disabled="!selection.count.value" @click="selection.clear()">Clear selection</Button>
        <div class="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" :disabled="!selection.count.value" @click="openBulk('move')">Move</Button>
          <Button size="sm" variant="outline" :disabled="!selection.count.value" @click="openBulk('edit')">Edit</Button>
          <Button size="sm" variant="outline" :disabled="!selection.count.value" @click="openExport(true)">Export</Button>
          <Button size="sm" variant="outline" class="text-destructive" :disabled="!selection.count.value" @click="openBulk('delete')">Delete</Button>
          <Button size="sm" @click="selection.stop()">Done</Button>
        </div>
      </div>
    </div>

    <CardDetailDialog v-model:open="detailOpen" :row="detailRow" :currency="currency" :readonly="!editable" @changed="refresh" />
    <template v-if="editable">
      <AddCardDialog v-model:open="addOpen" :default-location="defaultLocation" @added="refresh" />
      <ImportDialog v-model:open="importOpen" :default-location="defaultLocation" @imported="refresh" />
      <BulkDialog v-model:open="bulkOpen" :action="bulkAction" :selection="selection.toSelection" @done="afterBulk" />
    </template>
    <ExportDialog v-model:open="exportOpen" :load="loadExport" :filename="location ? `location-${location}` : 'collection'" />
  </div>
</template>
