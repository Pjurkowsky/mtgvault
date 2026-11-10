<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BookOpenIcon,
  CameraIcon,
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  DownloadIcon,
  EllipsisIcon,
  PencilIcon,
  SettingsIcon,
  Trash2Icon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useRoute, useRouter } from 'vue-router'
import { api, type Schemas } from '@/api/client'
import BinderSearchNav from '@/components/binder/BinderSearchNav.vue'
import BinderView from '@/components/binder/BinderView.vue'
import UnplacedSidebar from '@/components/binder/UnplacedSidebar.vue'
import { binderCache } from '@/lib/binder'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import CardSizeToggle from '@/components/CardSizeToggle.vue'
import AddToDeckDialog from '@/components/decks/AddToDeckDialog.vue'
import CardDetailDialog from '@/components/collection/CardDetailDialog.vue'
import EditItemDialog from '@/components/collection/EditItemDialog.vue'
import ImportDialog from '@/components/collection/ImportDialog.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBrowserQuery, type View } from '@/composables/useBrowserQuery'
import { useConfirm } from '@/composables/useConfirm'
import { useInfiniteItems, type Page } from '@/composables/useInfiniteItems'
import { usePreference } from '@/composables/usePreference'
import { useSelection, type Selection } from '@/composables/useSelection'
import { CARD_SIZES, SORTS, type CardSize } from '@/lib/cards'
import type { Money } from '@/lib/money'
import BulkDialog, { type BulkAction } from './BulkDialog.vue'
import CardGrid from './CardGrid.vue'
import CardTable from './CardTable.vue'
import ExportDialog, { type ExportOptions } from './ExportDialog.vue'
import FilterPopover from './FilterPopover.vue'
import WantDialog from '@/components/wants/WantDialog.vue'
import WantSection from '@/components/wants/WantSection.vue'
import type { MenuItem } from './CardMenu.vue'
import { wantRow, type BrowserRow, type BrowserSource, type WantRow } from './types'

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
  /** The location is a Binder: offer the binder view (spec 007, AC-1). */
  binder?: boolean
  /** Edit location and Delete in the ⋯ menu (spec 009, AC-1). */
  locationMenu?: boolean
}>()
const emit = defineEmits<{ changed: []; 'edit-location': []; 'delete-location': [] }>()

const { filter, view, update, setView, clearFilters, activeFilterCount } = useBrowserQuery()
const selection = useSelection()
const confirm = useConfirm()
const router = useRouter()
const route = useRoute()
// The want list (spec 010): its own rows, menu and dialogs; no selection, scanning or import.
const isWants = computed(() => props.source.kind === 'wants' || props.source.kind === 'public-wants')
const editable = computed(() => (props.source.kind === 'own' || props.source.kind === 'wants') && !props.readonly)
const selectable = computed(() => editable.value && !isWants.value)
// The cart (spec 003): scanned cards waiting to be moved into the collection.
const isCart = computed(() => props.location === 'cart')
// Adding and importing don't fit the cart.
const canAdd = computed(() => editable.value && !isCart.value)
const selecting = computed(() => selection.count.value > 0)
// The want list has no location of its own: the user picks one (spec 010, AC-3).
const defaultLocation = computed(() =>
  isWants.value ? undefined : props.location && props.location !== 'unfiled' ? Number(props.location) : null)
const menuItems = computed<MenuItem[] | undefined>(() =>
  !isWants.value ? undefined : editable.value ? ['open', 'edit', 'collect', 'delete'] : ['open'])

// ----- binder view (spec 007, AC-1, AC-5) -----
const binderId = computed(() =>
  !props.binder ? null : props.source.kind === 'public' ? props.source.locationId : Number(props.location) || null)
const binderKey = () => `mtgvault.binder.view.${binderId.value}`
function storedBinderView(): View | null {
  try {
    const v = localStorage.getItem(binderKey())
    return v === 'grid' || v === 'table' || v === 'binder' ? v : null
  } catch {
    return null
  }
}
/** A binder opens in binder view until a view is picked there; elsewhere there is no binder view. */
const shownView = computed<View>(() => {
  const fromUrl = route.query.view as View | undefined
  if (binderId.value) return fromUrl && ['grid', 'table', 'binder'].includes(fromUrl) ? fromUrl : storedBinderView() ?? 'binder'
  return view.value === 'binder' ? 'grid' : view.value
})
function pickView(next: View) {
  if (binderId.value) {
    try {
      localStorage.setItem(binderKey(), next)
    } catch {
      /* the URL still carries it */
    }
  }
  if (next === 'binder') update({ view: 'binder' })
  else setView(next)
}
const binderVersion = ref(0)
const binderRef = ref<InstanceType<typeof BinderView> | null>(null)
const inBinder = computed(() => shownView.value === 'binder' && !!binderId.value)
// Pocket size, remembered in this browser (spec 009, AC-4).
const binderSize = usePreference<CardSize>('binder.size', 'md', CARD_SIZES)
// Grid and Table view of a binder keep its Unplaced sidebar, so switching views moves nothing (AC-2, AC-7).
const sideUnplaced = ref<{ row: BrowserRow; count: number }[]>([])
const sidebarHere = computed(() => !!binderId.value && editable.value && !inBinder.value)
async function loadUnplaced() {
  if (!sidebarHere.value) return
  const { data } = await api.GET('/api/locations/{id}/binder/', { params: { path: { id: binderId.value! } } })
  if (data) binderCache.set(`own/${binderId.value}`, data)
  const items = new Map((data?.items ?? []).map((r) => [r.id, r as BrowserRow]))
  sideUnplaced.value = (data?.unplaced ?? []).map((u) => ({ row: items.get(u.item)!, count: u.count })).filter((u) => u.row)
    .sort((a, b) => a.row.printing.name.localeCompare(b.row.printing.name))
}
watch([sidebarHere, binderVersion], loadUnplaced, { immediate: true })

// Binder settings from the ⋯ menu: opens the binder view first (AC-1).
const settingsWanted = ref(false)
function openBinderSettings() {
  if (!inBinder.value) pickView('binder')
  settingsWanted.value = true
}

// ----- data -----
const query = computed(() => ({
  ...filter.value,
  ...(props.location ? { location: props.location } : {}),
}))

type BrowserPage = Page<BrowserRow> & { total_values?: Money }

async function fetchPage(offset: number, limit: number): Promise<BrowserPage | undefined> {
  const pageQuery = { ...query.value, offset: String(offset), limit: String(limit) }
  if (props.source.kind === 'own') {
    return (await api.GET('/api/items/', { params: { query: pageQuery } })).data
  }
  if (props.source.kind === 'wants' || props.source.kind === 'public-wants') {
    const { data } = props.source.kind === 'wants'
      ? await api.GET('/api/wants/', { params: { query: pageQuery } })
      : await api.GET('/api/users/{username}/wants/', { params: { path: { username: props.source.username }, query: pageQuery } })
    return data && { ...data, results: data.results.map(wantRow) }
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
  binderVersion.value++
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
const deckOpen = ref(false)
const deckSelection = ref<() => Selection>(() => selection.toSelection())

/** Add to deck from the menu (one card) or the bulk bar (the selection) (spec 004, AC-10). */
function openAddToDeck(row?: BrowserRow) {
  deckSelection.value = row ? () => ({ ids: [row.id] }) : selection.toSelection
  deckOpen.value = true
}

function openDetail(row: BrowserRow) {
  detailRow.value = row
  detailOpen.value = true
}

// ----- Add from the card dialog, or Add to collection from the want list (spec 010, AC-2, AC-3, AC-12) -----
type AddPreset = { card: { oracle_id: string; name: string }; printingId: string | null; quantity?: number
  finish?: Schemas['FinishEnum'] | null; location?: number | null }
const addPreset = ref<AddPreset | null>(null)
function openAdd(preset: AddPreset | null = null) {
  addPreset.value = preset
  addOpen.value = true
}
function addFromDetail(card: { oracle_id: string; name: string }, printingId: string | null) {
  openAdd({ card, printingId, location: defaultLocation.value })
}

// ----- want list entries (spec 010, AC-9 to AC-12) -----
const wantOpen = ref(false)
const wantEntry = ref<WantRow | null>(null)
function openWant(row: BrowserRow | null) {
  wantEntry.value = (row?.want as WantRow | undefined) ?? null
  wantOpen.value = true
}
function collect(row: BrowserRow) {
  const w = row.want as WantRow
  openAdd({
    card: { oracle_id: w.printing.oracle_id, name: w.printing.name }, printingId: w.printing.id, quantity: w.quantity,
    finish: w.finish === 'any' ? null : w.finish, location: w.deck_location ?? undefined,
  })
}
async function deleteWant(row: BrowserRow) {
  const ok = await confirm({ title: `Delete ${row.printing.name}?`, description: 'This removes it from your want list.' })
  if (!ok) return
  const { error } = await api.DELETE('/api/wants/{id}/', { params: { path: { id: row.id } } })
  if (error) return toast.error('Could not delete.')
  toast.success(`Deleted ${row.printing.name} from the want list.`)
  if (detailRow.value?.id === row.id) detailOpen.value = false
  refresh()
}
/** After saving: the open entry shows its new state, or closes if it merged away or was bought. */
async function afterWant() {
  refresh()
  if (!detailOpen.value || !detailRow.value?.want) return
  const { data } = await api.GET('/api/wants/{id}/', { params: { path: { id: detailRow.value.id } } })
  if (data) detailRow.value = wantRow(data)
  else detailOpen.value = false
}
const wantsPublic = ref(false)
const decks = ref<{ id: number; name: string }[]>([])
onMounted(async () => {
  if (props.source.kind !== 'wants') return
  const [settings, list] = await Promise.all([api.GET('/api/wants/settings/'), api.GET('/api/decks/')])
  wantsPublic.value = settings.data?.is_public ?? false
  decks.value = list.data?.decks ?? []
})
async function setWantsPublic(on: boolean) {
  const { data } = await api.PATCH('/api/wants/settings/', { body: { is_public: on } })
  if (!data) return toast.error('Could not change it.')
  wantsPublic.value = data.is_public
  toast.success(data.is_public ? 'Your want list is public.' : 'Your want list is private.')
  emit('changed')
}
const onEdit = (row: BrowserRow) => (isWants.value ? openWant(row) : openEdit(row))
const onDelete = (row: BrowserRow) => (isWants.value ? deleteWant(row) : deleteRow(row))

function openEdit(row: BrowserRow) {
  editRow.value = row
  editOpen.value = true
}

async function deleteRow(row: BrowserRow) {
  // From a binder pocket only that copy goes (spec 018, AC-3).
  const one = !!row.pocket && row.quantity > 1
  const count = one ? 1 : row.quantity
  const cards = `${count} ${count === 1 ? 'card' : 'cards'}`
  const ok = await confirm({ title: `Delete ${row.printing.name}?`, description: `This removes ${cards} from your collection.` })
  if (!ok) return
  const { error } = await api.DELETE('/api/items/{id}/', { params: { path: { id: row.id }, query: one ? { slot: row.pocket } : {} } })
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

/**
 * Open the scanner; Fast scanning needs a full page load of the isolated /scan/fast (spec 003, AC-16).
 * On a binder, scans go into it in order, from `place` when given (spec 007, AC-21).
 */
async function openScanner(place?: { page: number; row: number; col: number } | null) {
  const query: Record<string, string> = {}
  if (binderId.value) {
    query.location = String(binderId.value)
    if (place) Object.assign(query, { page: String(place.page), row: String(place.row), col: String(place.col) })
  }
  const { data } = await api.GET('/api/scanner/settings/')
  if (data?.fast) window.location.assign(`/scan/fast${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''}`)
  else router.push({ name: 'scan', query })
}

function openBulk(action: BulkAction) {
  bulkAction.value = action
  bulkOpen.value = true
}

function openExport(onlySelection: boolean) {
  exportSelection.value = onlySelection
  exportOpen.value = true
}

async function loadExport({ printings }: ExportOptions) {
  if (props.source.kind === 'public') {
    const { username, locationId } = props.source
    const { data } = await api.POST('/api/users/{username}/locations/{id}/export/', {
      params: { path: { username, id: locationId } },
      body: { filter: query.value as never, printings },
    })
    return data
  }
  const selected = exportSelection.value ? selection.toSelection() : { filter: query.value, exclude_ids: [] }
  const { data } = await api.POST('/api/items/export/', { body: { selection: selected as never, printings } })
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
const exportName = computed(() =>
  props.location ? `location-${props.location}` : 'collection')
</script>

<template>
  <div class="grid gap-4 pb-20">
    <!-- Toolbar: the same in every view, so nothing moves when switching (spec 009, AC-1, AC-2) -->
    <div class="flex flex-wrap items-center gap-2" data-testid="browser-toolbar">
      <ToggleGroup type="single" variant="outline" :model-value="shownView" @update:model-value="(v) => v && pickView(v as View)">
        <Tooltip v-if="binderId">
          <TooltipTrigger as-child><ToggleGroupItem value="binder" aria-label="Binder view"><BookOpenIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Binder view</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Grid view</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="table" aria-label="Table view"><ListIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Table view</TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <!-- Fixed width, so nothing after it moves when the view changes (spec 009, AC-2) -->
      <div class="relative w-full sm:w-48">
        <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="search" placeholder="Search" aria-label="Search cards" type="search"
          :class="inBinder && binderRef?.matchCount != null ? 'pr-28 pl-8' : 'pl-8'"
          @keydown.enter="binderRef?.nextMatch($event.shiftKey ? -1 : 1)"
        />
        <BinderSearchNav
          v-if="inBinder && binderRef" class="absolute inset-y-0 right-1"
          :matches="binderRef.matchCount" :current="binderRef.matchIndex" @step="(by) => binderRef?.nextMatch(by)"
        />
      </div>
      <FilterPopover
        :filter="filter" :active-count="activeFilterCount" :currency="currency" :disabled="inBinder" :wants="isWants" :decks="decks"
        @update="update" @clear="clearFilters"
      />
      <Select :model-value="filter.sort" :disabled="inBinder" @update:model-value="(v) => update({ sort: String(v) })">
        <SelectTrigger class="w-32" aria-label="Sort by"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
        </SelectContent>
      </Select>
      <IconButton
        :label="filter.dir === 'asc' ? 'Ascending' : 'Descending'" :disabled="inBinder"
        @click="update({ dir: filter.dir === 'asc' ? 'desc' : 'asc' })"
      >
        <ArrowUpNarrowWideIcon v-if="filter.dir === 'asc'" />
        <ArrowDownWideNarrowIcon v-else />
      </IconButton>
      <!-- Binder view only; elsewhere its space stays, so the buttons after it don't move (AC-2) -->
      <CardSizeToggle v-if="binderId" v-model="binderSize" :class="!inBinder && 'invisible'" :aria-hidden="!inBinder || undefined" />

      <div class="ml-auto flex items-center gap-2">
        <IconButton v-if="editable && !isWants" label="Scan cards" @click="openScanner()"><CameraIcon /></IconButton>
        <Button v-if="canAdd" @click="isWants ? openWant(null) : openAdd()"><PlusIcon /> Add card</Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <IconButton label="More"><EllipsisIcon /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem v-if="binderId && editable" @select="openBinderSettings"><SettingsIcon /> Binder settings</DropdownMenuItem>
            <DropdownMenuItem v-if="locationMenu" @select="emit('edit-location')"><PencilIcon /> Edit location</DropdownMenuItem>
            <DropdownMenuCheckboxItem v-if="source.kind === 'wants'" :model-value="wantsPublic" @update:model-value="setWantsPublic">
              Public
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem v-if="canAdd && !isWants" @select="importOpen = true"><UploadIcon /> Import</DropdownMenuItem>
            <DropdownMenuItem v-if="!isWants" @select="openExport(false)"><DownloadIcon /> Export</DropdownMenuItem>
            <template v-if="locationMenu">
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive" @select="emit('delete-location')"><Trash2Icon class="text-destructive" /> Delete</DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div v-if="page && !location && source.kind === 'own'" class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p data-testid="browser-summary">
        {{ cards(page.total_quantity) }} · <Price :value="page.total_value" :values="totalValues" :currency="currency" />
      </p>
      <p v-if="pricesUpdated" data-testid="prices-updated">Prices updated {{ pricesUpdated }}</p>
    </div>

    <!-- Results -->
    <BinderView
      v-if="inBinder"
      ref="binderRef"
      :source="source" :location-id="binderId!" :editable="editable" :version="binderVersion"
      :size="binderSize" :q="filter.q ?? ''" :settings-wanted="settingsWanted" @settings-opened="settingsWanted = false"
      @open="openDetail" @edit="openEdit" @delete="deleteRow" @deck="openAddToDeck" @scan="openScanner" @changed="refresh"
    />
    <CardGrid
      v-else-if="shownView === 'grid' && rows.length"
      :rows="rows" :currency="currency" :editable="editable" :selectable="selectable" :menu="menuItems" :selecting="selecting" :is-selected="selection.isSelected"
      @click="onCardClick" @check="check" @open="openDetail" @edit="onEdit" @delete="onDelete" @deck="openAddToDeck" @collect="collect"
    />
    <CardTable
      v-else-if="rows.length"
      :rows="rows" :currency="currency" :editable="editable" :selectable="selectable" :menu="menuItems" :selecting="selecting" :is-selected="selection.isSelected"
      :show-location="source.kind === 'own' && !location" :select-all-state="selectAllState" :wants="isWants"
      @click="onCardClick" @check="check" @open="openDetail" @edit="onEdit" @delete="onDelete" @deck="openAddToDeck" @collect="collect"
      @select-all="toggleSelectAll"
    />
    <p v-else-if="!loading && page && !inBinder" class="py-16 text-center text-muted-foreground" data-testid="browser-empty">
      {{ activeFilterCount || filter.q ? 'No cards match.' : 'No cards yet.' }}
    </p>
    <div v-if="loading && !rows.length && !inBinder" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      <Skeleton v-for="n in 10" :key="n" class="aspect-[488/680] w-full" />
    </div>
    <div ref="sentinel" aria-hidden="true" />
    <p v-if="loading && rows.length && !inBinder" class="text-center text-sm text-muted-foreground">Loading…</p>
    <p v-else-if="done && rows.length > 60 && !inBinder" class="text-center text-sm text-muted-foreground">End of list</p>

    <!-- Bulk bar while anything is selected (AC-15) -->
    <div
      v-if="selecting"
      class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))"
      data-testid="selection-bar"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="mr-2 font-medium" data-testid="selected-count">{{ selection.count.value }} selected</span>
        <label class="flex items-center gap-2 px-2 text-sm">
          <Checkbox :model-value="selectAllState" data-testid="select-all" @click.prevent="toggleSelectAll" />
          Select all {{ page?.count ?? '' }}
        </label>
        <div class="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" @click="openBulk('move')">{{ isCart ? 'Move to' : 'Move' }}</Button>
          <Button size="sm" variant="outline" @click="openBulk('edit')">Edit</Button>
          <Button v-if="!isCart" size="sm" variant="outline" @click="openAddToDeck()">Add to deck</Button>
          <Button size="sm" variant="outline" @click="openExport(true)">Export</Button>
          <Button size="sm" variant="outline" class="text-destructive" @click="openBulk('delete')">Delete</Button>
        </div>
      </div>
    </div>

    <CardDetailDialog
      v-model:open="detailOpen" :row="isWants ? null : detailRow" :oracle-id="detailRow?.printing.oracle_id" :printing-id="detailRow?.printing.id"
      :currency="currency" :readonly="!editable"
      @changed="refresh" @edit="openEdit" @delete="deleteRow" @add="addFromDetail"
    >
      <template v-if="isWants && detailRow?.want" #want>
        <WantSection
          :want="detailRow.want" :currency="currency" :readonly="!editable"
          @edit="openWant(detailRow)" @collect="collect(detailRow)" @delete="deleteWant(detailRow)"
        />
      </template>
    </CardDetailDialog>
    <template v-if="editable">
      <EditItemDialog v-model:open="editOpen" :row="editRow" @saved="onSaved" />
      <AddCardDialog
        v-model:open="addOpen" :card="addPreset?.card" :printing-id="addPreset?.printingId" :quantity="addPreset?.quantity"
        :finish="addPreset?.finish" :default-location="addPreset ? addPreset.location : defaultLocation" @added="isWants ? afterWant() : refresh()"
      />
      <WantDialog v-if="isWants" v-model:open="wantOpen" :entry="wantEntry" @saved="afterWant" />
      <ImportDialog v-if="!isWants" v-model:open="importOpen" :default-location="defaultLocation ?? null" @imported="refresh" />
      <AddToDeckDialog v-model:open="deckOpen" :selection="deckSelection" @done="selection.clear()" />
      <BulkDialog v-model:open="bulkOpen" :action="bulkAction" :selection="selection.toSelection" @done="afterBulk" />
    </template>
    <UnplacedSidebar v-if="sidebarHere" :unplaced="sideUnplaced" :over="false" :q="filter.q ?? ''" @open="openDetail" />
    <ExportDialog v-model:open="exportOpen" :load="loadExport" :filename="exportName" />
  </div>
</template>
