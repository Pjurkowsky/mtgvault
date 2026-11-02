<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  DownloadIcon,
  EllipsisIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import CardDetailDialog from '@/components/collection/CardDetailDialog.vue'
import EditItemDialog from '@/components/collection/EditItemDialog.vue'
import ImportDialog from '@/components/collection/ImportDialog.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBrowserQuery, type View } from '@/composables/useBrowserQuery'
import { useConfirm } from '@/composables/useConfirm'
import { useInfiniteItems, type Page } from '@/composables/useInfiniteItems'
import { useSelection } from '@/composables/useSelection'
import { SORTS } from '@/lib/cards'
import type { Money } from '@/lib/money'
import BulkDialog, { type BulkAction } from './BulkDialog.vue'
import CardGrid from './CardGrid.vue'
import CardTable from './CardTable.vue'
import ExportDialog from './ExportDialog.vue'
import FilterPopover from './FilterPopover.vue'
import type { BrowserRow, BrowserSource } from './types'

/**
 * The one card browser (spec 001 principle P-2): All cards, location pages and
 * public location pages all use it, so search, filters, sort, view and
 * selection behave the same everywhere.
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
const confirm = useConfirm()
const editable = computed(() => props.source.kind === 'own' && !props.readonly)
const selecting = computed(() => selection.count.value > 0)
const defaultLocation = computed(() => (props.location && props.location !== 'unfiled' ? Number(props.location) : null))

// ----- data -----
const query = computed(() => ({ ...filter.value, ...(props.location ? { location: props.location } : {}) }))

type BrowserPage = Page<BrowserRow> & { total_values?: Money }

async function fetchPage(offset: number, limit: number): Promise<BrowserPage | undefined> {
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
const totalValues = computed(() => (page.value as BrowserPage | null)?.total_values ?? null)

function refresh() {
  reload()
  emit('changed')
}

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
  searchTimer = setTimeout(() => update({ q: q.trim() || undefined }), 200)
})

// ----- selection (spec 002, AC-12 to AC-15) -----
let lastIndex: number | null = null

function check(row: BrowserRow, index: number, event: MouseEvent) {
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

/** Click on a card: toggles it while anything is selected, otherwise opens it (AC-13, AC-16). */
function onCardClick(row: BrowserRow, index: number, event: MouseEvent) {
  if (editable.value && (selecting.value || event.shiftKey)) return check(row, index, event)
  openDetail(row)
}

const selectAllState = computed<boolean | 'indeterminate'>(() =>
  selection.allSelected.value ? true : selecting.value ? 'indeterminate' : false,
)
/** Bulk bar and table header (AC-14): select every matching row, or clear when all are selected. */
function toggleSelectAll() {
  if (selection.allSelected.value) selection.clear()
  else selection.selectAll(query.value, page.value?.count ?? 0)
  lastIndex = null
}

// ----- dialogs -----
const detailRow = ref<BrowserRow | null>(null)
const detailOpen = ref(false)
const editRow = ref<BrowserRow | null>(null)
const editOpen = ref(false)
const addOpen = ref(false)
const importOpen = ref(false)
const exportOpen = ref(false)
const exportSelection = ref(false)
const bulkOpen = ref(false)
const bulkAction = ref<BulkAction | null>(null)

function openDetail(row: BrowserRow) {
  detailRow.value = row
  detailOpen.value = true
}

function openEdit(row: BrowserRow) {
  editRow.value = row
  editOpen.value = true
}

async function deleteRow(row: BrowserRow) {
  const cards = `${row.quantity} ${row.quantity === 1 ? 'card' : 'cards'}`
  const ok = await confirm({ title: `Delete ${row.printing.name}?`, description: `This removes ${cards} from your collection.` })
  if (!ok) return
  const { error } = await api.DELETE('/api/items/{id}/', { params: { path: { id: row.id } } })
  if (error) return toast.error('Could not delete.')
  toast.success(`Deleted ${row.printing.name}.`)
  selection.set(row.id, false)
  if (detailRow.value?.id === row.id) detailOpen.value = false
  refresh()
}

/** Keep an open detail showing the saved row (it may have merged into another). */
function onSaved(item: BrowserRow) {
  if (detailOpen.value && detailRow.value?.id === editRow.value?.id) detailRow.value = item
  refresh()
}

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
  selection.clear()
  refresh()
}

const pricesUpdated = computed(() => {
  const at = page.value?.prices_updated_at
  return at ? new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
})
const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`
</script>

<template>
  <div class="grid gap-4 pb-20">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" placeholder="Search" aria-label="Search cards" class="pl-8" type="search" />
      </div>
      <FilterPopover :filter="filter" :active-count="activeFilterCount" :currency="currency" @update="update" @clear="clearFilters" />
      <Select :model-value="filter.sort" @update:model-value="(v) => update({ sort: String(v) })">
        <SelectTrigger class="w-36" aria-label="Sort by"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
        </SelectContent>
      </Select>
      <IconButton
        :label="filter.dir === 'asc' ? 'Ascending' : 'Descending'"
        @click="update({ dir: filter.dir === 'asc' ? 'desc' : 'asc' })"
      >
        <ArrowUpNarrowWideIcon v-if="filter.dir === 'asc'" />
        <ArrowDownWideNarrowIcon v-else />
      </IconButton>
      <ToggleGroup type="single" variant="outline" :model-value="view" @update:model-value="(v) => v && setView(v as View)">
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Grid view</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="table" aria-label="Table view"><ListIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Table view</TooltipContent>
        </Tooltip>
      </ToggleGroup>

      <div class="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <IconButton label="More"><EllipsisIcon /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem v-if="editable" @select="importOpen = true"><UploadIcon /> Import</DropdownMenuItem>
            <DropdownMenuItem @select="openExport(false)"><DownloadIcon /> Export</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button v-if="editable" @click="addOpen = true"><PlusIcon /> Add card</Button>
      </div>
    </div>

    <div v-if="page" class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p data-testid="browser-summary">
        {{ cards(page.total_quantity) }} · <Price :value="page.total_value" :values="totalValues" :currency="currency" />
      </p>
      <p v-if="pricesUpdated" data-testid="prices-updated">Prices updated {{ pricesUpdated }}</p>
    </div>

    <!-- Results -->
    <CardGrid
      v-if="view === 'grid' && rows.length"
      :rows="rows" :currency="currency" :editable="editable" :selecting="selecting" :is-selected="selection.isSelected"
      @click="onCardClick" @check="check" @open="openDetail" @edit="openEdit" @delete="deleteRow"
    />
    <CardTable
      v-else-if="rows.length"
      :rows="rows" :currency="currency" :editable="editable" :selecting="selecting" :is-selected="selection.isSelected"
      :show-location="source.kind === 'own' && !location" :select-all-state="selectAllState"
      @click="onCardClick" @check="check" @open="openDetail" @edit="openEdit" @delete="deleteRow"
      @select-all="toggleSelectAll"
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

    <!-- Bulk bar while anything is selected (AC-15) -->
    <div
      v-if="selecting"
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))"
      data-testid="selection-bar"
    >
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span class="mr-2 font-medium" data-testid="selected-count">{{ selection.count.value }} selected</span>
        <label class="flex items-center gap-2 px-2 text-sm">
          <Checkbox :model-value="selectAllState" data-testid="select-all" @click.prevent="toggleSelectAll" />
          Select all {{ page?.count ?? '' }}
        </label>
        <div class="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" @click="openBulk('move')">Move</Button>
          <Button size="sm" variant="outline" @click="openBulk('edit')">Edit</Button>
          <Button size="sm" variant="outline" @click="openExport(true)">Export</Button>
          <Button size="sm" variant="outline" class="text-destructive" @click="openBulk('delete')">Delete</Button>
        </div>
      </div>
    </div>

    <CardDetailDialog
      v-model:open="detailOpen" :row="detailRow" :currency="currency" :readonly="!editable"
      @changed="refresh" @edit="openEdit" @delete="deleteRow"
    />
    <template v-if="editable">
      <EditItemDialog v-model:open="editOpen" :row="editRow" @saved="onSaved" />
      <AddCardDialog v-model:open="addOpen" :default-location="defaultLocation" @added="refresh" />
      <ImportDialog v-model:open="importOpen" :default-location="defaultLocation" @imported="refresh" />
      <BulkDialog v-model:open="bulkOpen" :action="bulkAction" :selection="selection.toSelection" @done="afterBulk" />
    </template>
    <ExportDialog v-model:open="exportOpen" :load="loadExport" :filename="location ? `location-${location}` : 'collection'" />
  </div>
</template>
