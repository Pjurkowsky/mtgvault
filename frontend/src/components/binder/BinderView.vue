<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useElementSize } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import type { BrowserRow, BrowserSource } from '@/components/browser/types'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useBinderDrag, type DragSource, type DropKey } from '@/composables/useBinderDrag'
import {
  binderCache, pageWidth, placeKey, pockets as toPockets, samePlace, sectionOf, viewIndexOf, views,
  type Binder, type BinderSlot, type Place,
} from '@/lib/binder'
import type { CardSize } from '@/lib/cards'
import BinderPage from './BinderPage.vue'
import BinderPagination from './BinderPagination.vue'
import BinderSettingsDialog from './BinderSettingsDialog.vue'
import FromUnplacedDialog from './FromUnplacedDialog.vue'
import MoveToSlotDialog from './MoveToSlotDialog.vue'
import StackDialog from './StackDialog.vue'
import UnplacedSidebar from './UnplacedSidebar.vue'

/**
 * A Binder location as its physical pages (spec 007): pockets, facing pages,
 * the Unplaced tray, drag and drop and the binder settings. Opening, editing and
 * deleting a card use the card browser's dialogs (emitted).
 */
const props = defineProps<{
  source: BrowserSource
  locationId: number
  editable: boolean
  version: number
  /** Pocket size (spec 009, AC-4). */
  size: CardSize
  /** The browser's search text (AC-5). */
  q: string
  /** Binder settings asked for from the ⋯ menu (AC-1). */
  settingsWanted: boolean
}>()
const emit = defineEmits<{
  'settings-opened': []
  open: [row: BrowserRow]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  deck: [row: BrowserRow]
  scan: [place: Place | null]
  changed: []
}>()
const route = useRoute()
const router = useRouter()

// ----- data -----
const cacheKey = () => (props.source.kind === 'public' ? `${props.source.username}/${props.locationId}` : `own/${props.locationId}`)
// Shown at once from the last visit, then refreshed.
const binder = ref<Binder | null>(binderCache.get(cacheKey()) ?? null)
async function load() {
  if (props.source.kind === 'public') {
    const { data } = await api.GET('/api/users/{username}/locations/{id}/binder/', {
      params: { path: { username: props.source.username, id: props.locationId } },
    })
    binder.value = data ?? null
  } else {
    const { data } = await api.GET('/api/locations/{id}/binder/', { params: { path: { id: props.locationId } } })
    binder.value = data ?? null
  }
}
watch(binder, (b) => b && binderCache.set(cacheKey(), b))
watch(() => [props.locationId, props.version], load, { immediate: true })

const items = computed(() => new Map((binder.value?.items ?? []).map((r) => [r.id, r as BrowserRow])))
const pockets = computed(() => toPockets(binder.value?.slots ?? []))
const unplaced = computed(() =>
  (binder.value?.unplaced ?? []).map((u) => ({ row: items.value.get(u.item)!, count: u.count })).filter((u) => u.row)
    .sort((a, b) => a.row.printing.name.localeCompare(b.row.printing.name)),
)

// ----- pages (AC-3, AC-4) -----
// Facing pages only when two pages of this size fit side by side (AC-4).
const pagesEl = ref<HTMLElement | null>(null)
const { width: pagesWidth } = useElementSize(pagesEl)
const onePage = computed(() => (binder.value ? pageWidth(binder.value.cols, props.size) : 0))
const PAGE_GAP = 12
const spread = computed(() => !!binder.value?.spread && pagesWidth.value >= 2 * onePage.value + PAGE_GAP)
const allViews = computed(() => views(binder.value?.page_count ?? 1, spread.value))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const viewIndex = computed(() => Math.min(viewIndexOf(page.value, spread.value), allViews.value.length - 1))
const shown = computed(() => allViews.value[viewIndex.value] ?? [1])
const pageLabel = computed(() => {
  const nums = shown.value.filter((p): p is number => p !== null)
  const of = binder.value?.page_count ?? 1
  return nums.length > 1 ? `Pages ${nums[0]}–${nums[1]} of ${of}` : `Page ${nums[0]} of ${of}`
})
function goTo(index: number) {
  const target = allViews.value[Math.max(0, Math.min(index, allViews.value.length - 1))]
  const first = target?.find((p) => p !== null) ?? 1
  if (first !== page.value) router.replace({ query: { ...route.query, page: first > 1 ? String(first) : undefined } })
}
const turn = (by: -1 | 1) => goTo(viewIndex.value + by)
const showPage = (p: number) => goTo(viewIndexOf(p, spread.value))

// ----- search (AC-5): matching pockets ring, the rest fade; Enter and the arrows step through -----
const needle = computed(() => props.q.trim().toLowerCase())
const nameOf = (s: BinderSlot) => items.value.get(s.item)?.printing.name.toLowerCase() ?? ''
const matches = computed<Place[]>(() => {
  if (!needle.value || !binder.value) return []
  const seen = new Set<string>()
  return binder.value.slots
    .filter((s) => nameOf(s).includes(needle.value))
    .sort((a, b) => a.page - b.page || a.row - b.row || a.col - b.col)
    .filter((s) => !seen.has(placeKey(s)) && seen.add(placeKey(s)))
    .map(({ page, row, col }) => ({ page, row, col }))
})
// No match fades nothing.
const matchKeys = computed(() => (matches.value.length ? new Set(matches.value.map(placeKey)) : null))
const matchIndex = ref(0)
const current = computed(() => matches.value[matchIndex.value] ?? null)
watch(needle, () => {
  matchIndex.value = 0
  if (current.value) showPage(current.value.page)
})
// A search in the URL: jump to its first match once the binder is there.
let jumped = false
watch(binder, (b) => {
  if (jumped || !b) return
  jumped = true
  if (current.value) showPage(current.value.page)
}, { immediate: true })
function nextMatch(by: -1 | 1) {
  const n = matches.value.length
  if (!n) return
  matchIndex.value = (matchIndex.value + by + n) % n
  showPage(current.value!.page)
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const el = e.target as HTMLElement | null
  if (el?.closest('input, textarea, select, [contenteditable], [role="menu"], [role="dialog"]')) return
  if (document.querySelector('[role="dialog"][data-state="open"]')) return
  e.preventDefault()
  turn(e.key === 'ArrowLeft' ? -1 : 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ----- writes -----
type MoveBody = { slot?: number; item?: number; to: Place | null; mode?: 'swap' | 'share' }
async function move(body: MoveBody) {
  const { data, error } = await api.POST('/api/locations/{id}/binder/move/', {
    params: { path: { id: props.locationId } }, body: body as never,
  })
  if (!data) return toast.error(Object.values((error ?? {}) as Record<string, string[]>).flat()[0] ?? 'Could not move the card.')
  binder.value = data
}

/** A pocket already holding other cards asks: swap, or share (AC-17). */
const choice = ref<{ open: boolean; resolve: ((mode: 'swap' | 'share' | null) => void) | null }>({ open: false, resolve: null })
function ask(): Promise<'swap' | 'share' | null> {
  return new Promise((resolve) => (choice.value = { open: true, resolve }))
}
function answer(mode: 'swap' | 'share' | null) {
  choice.value.resolve?.(mode)
  choice.value = { open: false, resolve: null }
}

async function put(from: { slot?: BinderSlot; item?: number }, to: Place | null) {
  if (!to) return from.slot && move({ slot: from.slot.id, to: null })
  if (from.slot && samePlace(from.slot, to)) return
  const others = (pockets.value.get(placeKey(to)) ?? []).filter((s) => s.id !== from.slot?.id)
  let mode: 'swap' | 'share' = 'swap'
  if (others.length) {
    const picked = await ask()
    if (!picked) return
    mode = picked
  }
  await move({ ...(from.slot ? { slot: from.slot.id } : { item: from.item }), to, mode })
}

// ----- drag and drop (AC-15, AC-16) -----
// A drag from a pocket opens the Unplaced sidebar as a drop target until the drop (AC-8).
const dragOpened = ref(false)
const slotsById = computed(() => new Map((binder.value?.slots ?? []).map((s) => [s.id, s])))
const drag = useBinderDrag({
  edgeEl: () => pagesEl.value,
  onEdge: (direction) => turn(direction),
  onDrop: (source: DragSource, target: DropKey) => {
    const slot = source.slot ? slotsById.value.get(source.slot) : undefined
    if (target === 'tray') return slot && put({ slot }, null)
    const [p, r, c] = target.split('-').map(Number)
    void put(slot ? { slot } : { item: source.item }, { page: p!, row: r!, col: c! })
  },
})
function startDrag(source: DragSource, event: PointerEvent) {
  drag.start(source, event)
}
watch(drag.source, (s) => {
  dragOpened.value = !!s?.slot
})

// ----- dialogs -----
/** Dialogs opened from a menu wait a tick, so the menu's focus return doesn't land under them. */
const later = (fn: () => void) => setTimeout(fn, 0)
const settingsOpen = ref(false)
watch([() => props.settingsWanted, binder], ([wanted, b]) => {
  if (!wanted || !b) return
  emit('settings-opened')
  later(() => (settingsOpen.value = true))
}, { immediate: true })
const moveOpen = ref(false)
const moveSlot = ref<BinderSlot | null>(null)
const stackOpen = ref(false)
const stackPlace = ref<Place | null>(null)
const unplacedOpen = ref(false)
const addOpen = ref(false)
const targetPlace = ref<Place | null>(null)

const stack = computed(() => (stackPlace.value ? pockets.value.get(placeKey(stackPlace.value)) ?? [] : []))
watch(stack, (s) => stackOpen.value && s.length < 2 && (stackOpen.value = false))

function openMove(slot: BinderSlot) {
  moveSlot.value = slot
  later(() => (moveOpen.value = true))
}
function openStack(place: Place) {
  stackPlace.value = place
  stackOpen.value = true
}
function openAdd(place: Place) {
  targetPlace.value = place
  later(() => (addOpen.value = true))
}
function openFromUnplaced(place: Place) {
  targetPlace.value = place
  later(() => (unplacedOpen.value = true))
}
async function order(ids: number[]) {
  const place = stackPlace.value
  if (!place) return
  const { data } = await api.POST('/api/locations/{id}/binder/order/', {
    params: { path: { id: props.locationId } }, body: { ...place, slots: ids },
  })
  if (data) binder.value = data
}
function openFromStack(row: BrowserRow) {
  stackOpen.value = false
  later(() => emit('open', row))
}
function added() {
  void load()
  emit('changed')
}
defineExpose({
  reload: load,
  nextMatch,
  matchCount: computed(() => (needle.value ? matches.value.length : null)),
  matchIndex,
})
</script>

<template>
  <div v-if="binder" class="grid gap-4" data-testid="binder">
    <div class="flex items-start">
      <div class="grid min-w-0 flex-1 gap-4">
        <div ref="pagesEl" class="flex justify-center-safe gap-3 overflow-x-auto pb-1" data-testid="binder-spread">
          <template v-for="(p, i) in shown" :key="p ?? `blank-${i}`">
            <BinderPage
              v-if="p !== null"
              :page="p" :binder="binder" :pockets="pockets" :items="items" :section="sectionOf(p, binder.sections)"
              :size="size" :matches="matchKeys" :current="current ? placeKey(current) : null"
              :editable="editable" :has-unplaced="unplaced.length > 0" :over="drag.over.value" :dragging="!!drag.source.value"
              @open="emit('open', $event)" @stack="openStack" @edit="(r) => later(() => emit('edit', r))" @delete="(r) => later(() => emit('delete', r))"
              @deck="(r) => later(() => emit('deck', r))" @move="openMove" @unplace="(s) => put({ slot: s }, null)"
              @add="openAdd" @from-unplaced="openFromUnplaced" @scan="(pl) => emit('scan', pl)" @drag="startDrag"
            />
            <div v-else class="flex-none" :style="{ width: `${onePage}px` }" aria-hidden="true" />
          </template>
        </div>
        <BinderPagination :views="allViews" :current="viewIndex" @go="goTo" />
        <span class="sr-only" aria-live="polite" data-testid="binder-pages">{{ pageLabel }}</span>
        <p v-if="binder.total" class="text-center text-sm text-muted-foreground" data-testid="binder-used">{{ binder.used }} / {{ binder.total }} slots</p>
      </div>

      <UnplacedSidebar
        v-if="editable" :unplaced="unplaced" :over="drag.over.value === 'tray'" :q="q" :force-open="dragOpened" draggable
        @open="emit('open', $event)" @drag="startDrag"
      />
    </div>
    <!-- Drag ghost -->
    <img
      v-if="drag.source.value" :src="drag.source.value.image" :alt="drag.source.value.name" aria-hidden="true"
      class="pointer-events-none fixed z-50 w-24 -translate-x-1/2 -translate-y-1/2 rotate-3 rounded-[4.75%/3.5%] opacity-90 shadow-2xl"
      :style="{ left: `${drag.pointer.value.x}px`, top: `${drag.pointer.value.y}px` }" data-testid="drag-ghost"
    />

    <template v-if="editable">
      <BinderSettingsDialog v-model:open="settingsOpen" :location-id="locationId" :binder="binder" @saved="(b) => (binder = b)" />
      <MoveToSlotDialog
        v-model:open="moveOpen" :binder="binder" :from="moveSlot" :name="moveSlot ? items.get(moveSlot.item)?.printing.name ?? '' : ''"
        @move="(to) => moveSlot && put({ slot: moveSlot }, to)"
      />
      <FromUnplacedDialog v-model:open="unplacedOpen" :binder="binder" :place="targetPlace" :unplaced="unplaced" @pick="(r) => targetPlace && put({ item: r.id }, targetPlace)" />
      <AddCardDialog v-model:open="addOpen" :default-location="locationId" :pocket="targetPlace" @added="added" />
      <Dialog :open="choice.open" @update:open="(v) => !v && answer(null)">
        <DialogContent class="sm:max-w-sm" data-testid="drop-choice">
          <DialogHeader>
            <DialogTitle>This slot is taken</DialogTitle>
            <DialogDescription>Swap the cards, or keep both in this slot.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="answer('share')">Share slot</Button>
            <Button @click="answer('swap')">Swap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
    <StackDialog
      v-model:open="stackOpen" :place="stackPlace" :cols="binder.cols" :stack="stack" :items="items" :editable="editable"
      @open="openFromStack" @order="order"
    />
  </div>
  <div v-else class="grid grid-cols-3 gap-2 md:w-1/2">
    <Skeleton v-for="n in 9" :key="n" class="aspect-[488/680] w-full" />
  </div>
</template>
