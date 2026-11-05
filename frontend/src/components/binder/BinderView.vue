<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon, SettingsIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import type { BrowserRow, BrowserSource } from '@/components/browser/types'
import AddCardDialog from '@/components/collection/AddCardDialog.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useBinderDrag, type DragSource, type DropKey } from '@/composables/useBinderDrag'
import {
  placeKey, pockets as toPockets, samePlace, sectionOf, viewIndexOf, views,
  type Binder, type BinderSlot, type Place,
} from '@/lib/binder'
import BinderPage from './BinderPage.vue'
import BinderSettingsDialog from './BinderSettingsDialog.vue'
import FromUnplacedDialog from './FromUnplacedDialog.vue'
import MoveToSlotDialog from './MoveToSlotDialog.vue'
import StackDialog from './StackDialog.vue'
import UnplacedTray from './UnplacedTray.vue'

/**
 * A Binder location as its physical pages (spec 007): pockets, facing pages,
 * the Unplaced tray, drag and drop and the binder settings. Opening, editing and
 * deleting a card use the card browser's dialogs (emitted).
 */
const props = defineProps<{ source: BrowserSource; locationId: number; editable: boolean; version: number }>()
const emit = defineEmits<{
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
const binder = ref<Binder | null>(null)
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
watch(() => [props.locationId, props.version], load, { immediate: true })

const items = computed(() => new Map((binder.value?.items ?? []).map((r) => [r.id, r as BrowserRow])))
const pockets = computed(() => toPockets(binder.value?.slots ?? []))
const unplaced = computed(() =>
  (binder.value?.unplaced ?? []).map((u) => ({ row: items.value.get(u.item)!, count: u.count })).filter((u) => u.row)
    .sort((a, b) => a.row.printing.name.localeCompare(b.row.printing.name)),
)
const unplacedTotal = computed(() => unplaced.value.reduce((n, u) => n + u.count, 0))

// ----- pages (AC-3, AC-4) -----
const wide = useMediaQuery('(min-width: 768px)')
const spread = computed(() => !!binder.value?.spread && wide.value)
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
const pagesEl = ref<HTMLElement | null>(null)
const trayOpen = ref(false)
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
// On phones the tray is a sheet over the pages: close it once a drag starts.
watch(drag.source, (s) => s && !wide.value && (trayOpen.value = false))

// ----- dialogs -----
/** Dialogs opened from a menu wait a tick, so the menu's focus return doesn't land under them. */
const later = (fn: () => void) => setTimeout(fn, 0)
const settingsOpen = ref(false)
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
defineExpose({ reload: load })
</script>

<template>
  <div v-if="binder" class="grid gap-4" data-testid="binder">
    <div class="flex flex-wrap items-center gap-2">
      <IconButton label="Previous page" variant="outline" :disabled="viewIndex === 0" @click="turn(-1)"><ChevronLeftIcon /></IconButton>
      <span class="min-w-32 text-center text-sm tabular-nums" data-testid="binder-pages">{{ pageLabel }}</span>
      <IconButton label="Next page" variant="outline" :disabled="viewIndex >= allViews.length - 1" @click="turn(1)"><ChevronRightIcon /></IconButton>
      <span v-if="binder.total" class="text-sm text-muted-foreground" data-testid="binder-used">{{ binder.used }} / {{ binder.total }} slots</span>
      <div class="ml-auto flex items-center gap-2">
        <Button v-if="editable && !wide" variant="outline" size="sm" @click="trayOpen = true"><InboxIcon /> Unplaced {{ unplacedTotal }}</Button>
        <IconButton v-if="editable" label="Binder settings" variant="outline" @click="settingsOpen = true"><SettingsIcon /></IconButton>
      </div>
    </div>

    <div class="grid items-start gap-4" :class="editable && wide && 'grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,1fr)_18rem]'">
      <div ref="pagesEl" class="flex gap-3" data-testid="binder-spread">
        <template v-for="(p, i) in shown" :key="p ?? `blank-${i}`">
          <BinderPage
            v-if="p !== null"
            :page="p" :binder="binder" :pockets="pockets" :items="items" :section="sectionOf(p, binder.sections)"
            :editable="editable" :has-unplaced="unplaced.length > 0" :over="drag.over.value" :dragging="!!drag.source.value"
            @open="emit('open', $event)" @stack="openStack" @edit="(r) => later(() => emit('edit', r))" @delete="(r) => later(() => emit('delete', r))"
            @deck="(r) => later(() => emit('deck', r))" @move="openMove" @unplace="(s) => put({ slot: s }, null)"
            @add="openAdd" @from-unplaced="openFromUnplaced" @scan="(pl) => emit('scan', pl)" @drag="startDrag"
          />
          <div v-else class="min-w-0 flex-1" aria-hidden="true" />
        </template>
      </div>
      <UnplacedTray
        v-if="editable && wide" class="sticky top-4" :unplaced="unplaced" :editable="editable" :over="drag.over.value === 'tray'"
        @open="emit('open', $event)" @drag="startDrag"
      />
    </div>

    <Sheet v-if="editable && !wide" v-model:open="trayOpen">
      <SheetContent side="bottom" class="max-h-[70vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Unplaced</SheetTitle></SheetHeader>
        <UnplacedTray class="border-0 p-0" :unplaced="unplaced" :editable="editable" :over="false" @open="emit('open', $event)" @drag="startDrag" />
      </SheetContent>
    </Sheet>

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
