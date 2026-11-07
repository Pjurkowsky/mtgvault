<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftRightIcon, CameraOffIcon, LayersIcon, PackageIcon, SettingsIcon, ShoppingCartIcon, XIcon } from '@lucide/vue'
import { api } from '@/api/client'
import type { BrowserRow } from '@/components/browser/types'
import EditItemDialog from '@/components/collection/EditItemDialog.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import GuessStrip from '@/components/scanner/GuessStrip.vue'
import ResultBar from '@/components/scanner/ResultBar.vue'
import ScannerSettingsSheet from '@/components/scanner/ScannerSettingsSheet.vue'
import ScanTargetDialog from '@/components/decks/ScanTargetDialog.vue'
import BinderScanDialog, { type BinderScan } from '@/components/binder/BinderScanDialog.vue'
import { nextPlace, placeKey, placeLabel, slotNumber, type Place } from '@/lib/binder'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { loadScanTarget, saveScanTarget, type ScanTarget } from '@/lib/scanTarget'
import { CAMERA_HELP } from '@/scanner/camera'
import { unlockAudio } from '@/scanner/sounds'
import { useScanner, type ScanItem } from '@/scanner/useScanner'
import { useAuthStore } from '@/stores/auth'

/** Full-screen scanner (spec 003). With ?deck=, scans go where that deck's choice says (spec 005, AC-16). */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const deckId = computed(() => (route.query.deck ? Number(route.query.deck) : null))
const target = ref<ScanTarget | null>(deckId.value ? loadScanTarget(deckId.value) : null)
const deck = ref<{ id: number; name: string; location: number | null } | null>(null)
const locationNames = ref<Record<string, string>>({})

// A binder's scans (spec 007, AC-20 to AC-23): in order from a cursor, or Unplaced.
const binderId = computed(() => (route.query.location ? Number(route.query.location) : null))
const binderGrid = ref<{ rows: number; cols: number } | null>(null)
const num = (v: unknown) => Math.max(1, Number(v) || 1)
const binderScan = ref<BinderScan>({
  inOrder: true,
  cursor: { page: num(route.query.page), row: num(route.query.row), col: num(route.query.col) },
  direction: 'rows',
})
const lastSlot = ref<(Place & { id: number }) | null>(null)
const binderFull = ref(false)
const binderOpen = ref(false)
if (binderId.value) {
  target.value = { kind: 'location', location: binderId.value }
}
function firstEmpty(b: { rows: number; cols: number; slots: Place[] }): Place {
  const taken = new Set(b.slots.map(placeKey))
  let p: Place = { page: 1, row: 1, col: 1 }
  while (taken.has(placeKey(p))) p = nextPlace(p, b.rows, b.cols, 'rows')
  return p
}
function binderTarget(): ScanTarget | null {
  if (!binderId.value) return target.value
  const b = binderScan.value
  return { kind: 'location', location: binderId.value, ...(b.inOrder ? { binder: { ...b.cursor, direction: b.direction } } : {}) }
}
const scanner = useScanner(binderTarget, {
  logged(result) {
    if (!binderId.value) return
    binderFull.value = !!result.binder_full
    lastSlot.value = result.slot ?? null
    const grid = binderGrid.value
    if (result.slot && grid) {
      binderScan.value = { ...binderScan.value, cursor: nextPlace(result.slot, grid.rows, grid.cols, binderScan.value.direction) }
    }
  },
  undoSlot: () => lastSlot.value?.id ?? null,
  undone() {
    // The freed pocket is where the next card goes.
    if (lastSlot.value) binderScan.value = { ...binderScan.value, cursor: { page: lastSlot.value.page, row: lastSlot.value.row, col: lastSlot.value.col } }
    lastSlot.value = null
    binderFull.value = false
  },
})
const { camera, status, settings, lastScan, lastDeckCard, cart, ready, guesses } = scanner
const currency = computed(() => auth.user?.currency ?? 'USD')
const settingsOpen = ref(false)
const editOpen = ref(false)

const targetOpen = ref(false)

onMounted(async () => {
  if (deckId.value) {
    const [d, l] = await Promise.all([
      api.GET('/api/decks/{id}/', { params: { path: { id: deckId.value } } }),
      api.GET('/api/locations/'),
    ])
    if (d.data) deck.value = { id: d.data.id, name: d.data.name, location: d.data.location }
    locationNames.value = Object.fromEntries((l.data?.locations ?? []).map((x) => [String(x.id), x.name]))
    if (deck.value && !target.value) target.value = deck.value.location ? { kind: 'location', location: deck.value.location } : { kind: 'cart' }
  }
  if (binderId.value) {
    const [b, l] = await Promise.all([
      api.GET('/api/locations/{id}/binder/', { params: { path: { id: binderId.value } } }),
      api.GET('/api/locations/'),
    ])
    if (b.data) {
      binderGrid.value = { rows: b.data.rows, cols: b.data.cols }
      // Without a start slot, scans start at the first empty one (AC-21).
      if (!route.query.page) binderScan.value = { ...binderScan.value, cursor: firstEmpty(b.data) }
    }
    locationNames.value = Object.fromEntries((l.data?.locations ?? []).map((x) => [String(x.id), x.name]))
  }
  void scanner.start()
})

/** The destination chip: what it says and where it links. */
const destination = computed(() => {
  const t = target.value
  if (t?.kind === 'deck') return { label: deck.value?.name ?? 'Decklist', icon: LayersIcon, to: { name: 'deck', params: { id: t.deck } } }
  if (t?.kind === 'location') {
    const id = t.location === null ? 'unfiled' : String(t.location)
    return { label: t.location === null ? 'Unfiled' : (locationNames.value[id] ?? 'Location'), icon: PackageIcon, to: { name: 'location', params: { id } } }
  }
  return { label: 'Cart', icon: ShoppingCartIcon, to: { name: 'location', params: { id: 'cart' } } }
})

function changeBinderScan(next: BinderScan) {
  binderScan.value = next
  binderFull.value = false
  lastSlot.value = null
  void scanner.retarget()
}
const binderLabel = computed(() => {
  const b = binderScan.value
  const grid = binderGrid.value
  if (!b.inOrder) return 'Unplaced'
  return `${grid ? placeLabel(b.cursor, grid.cols) : `Page ${b.cursor.page}`} ${b.direction === 'rows' ? '→' : '↓'}`
})
// "P1·5 →" on narrow phones (spec 017, AC-1).
const binderShort = computed(() => {
  const b = binderScan.value
  const grid = binderGrid.value
  if (!b.inOrder) return 'Unplaced'
  const slot = grid ? `·${slotNumber(b.cursor, grid.cols)}` : ''
  return `P${b.cursor.page}${slot} ${b.direction === 'rows' ? '→' : '↓'}`
})

function changeTarget(next: ScanTarget) {
  target.value = next
  if (deckId.value) saveScanTarget(deckId.value, next)
  void scanner.retarget()
}

const statusText = computed(() => {
  const s = status.value
  if (s.kind === 'looking') return 'Hold a card in view'
  if (s.kind === 'steady') return s.name ? `Hold steady… ${s.name}?` : 'Hold steady'
  if (s.kind === 'glare') return 'Glare: tilt the phone'
  if (s.kind === 'logged') return `Added ${s.name}`
  if (s.kind === 'outside') return `Not in locked sets: ${s.name}`
  return ''
})
const percent = computed(() => {
  const s = status.value
  return s.kind === 'loading' && s.progress?.total ? Math.round((s.progress.loaded / s.progress.total) * 100) : 0
})
const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`

function close() {
  if (binderId.value) return router.push({ name: 'location', params: { id: String(binderId.value) } })
  router.push(deckId.value ? { name: 'deck', params: { id: deckId.value } } : { name: 'collection' })
}
function tapToResume() {
  unlockAudio()
  if (status.value.kind === 'paused') void scanner.resume()
}
function onEdited(item: BrowserRow) {
  scanner.replaceLast(item as ScanItem)
}
</script>

<template>
  <div class="fixed inset-0 bg-black text-white" @click="unlockAudio" data-testid="scanner">
    <video :ref="(el) => (camera.video.value = el as HTMLVideoElement)" autoplay muted playsinline class="absolute inset-0 size-full object-cover" />

    <!-- Top controls -->
    <!-- z-10: close, cart and settings stay usable over the loading and error screens. -->
    <div class="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3" style="padding-top: calc(0.75rem + env(safe-area-inset-top, 0px))">
      <!-- One row at any width: labels truncate, Change is an icon (spec 017, AC-1). -->
      <IconButton label="Close scanner" variant="secondary" class="shrink-0" @click="close"><XIcon /></IconButton>
      <RouterLink
        :to="destination.to"
        class="flex min-w-0 items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-sm whitespace-nowrap text-foreground shadow"
        data-testid="cart-link"
      >
        <component :is="destination.icon" class="size-4 shrink-0" />
        <span class="min-w-0 truncate" data-testid="scan-destination">{{ destination.label }}</span>
        <span v-if="settings?.show_total && cart" data-testid="running-total" class="shrink-0 text-muted-foreground">
          <span class="max-[399px]:hidden">{{ cards(cart.card_count) }} · </span><Price :value="cart.value" :values="cart.values" :currency="currency" />
        </span>
      </RouterLink>
      <IconButton v-if="deck" label="Change" variant="secondary" class="shrink-0" @click="targetOpen = true"><ArrowLeftRightIcon /></IconButton>
      <template v-if="binderId">
        <span class="shrink-0 rounded-md bg-background/90 px-3 py-2 text-sm whitespace-nowrap text-foreground shadow">
          <span class="max-[399px]:hidden" data-testid="binder-cursor">{{ binderLabel }}</span>
          <span class="min-[400px]:hidden" aria-hidden="true">{{ binderShort }}</span>
        </span>
        <IconButton label="Change" variant="secondary" class="shrink-0" :disabled="!binderGrid" @click="binderOpen = true"><ArrowLeftRightIcon /></IconButton>
      </template>
      <div class="ml-auto shrink-0">
        <IconButton label="Scanner settings" variant="secondary" :disabled="!settings" @click="settingsOpen = true"><SettingsIcon /></IconButton>
      </div>
    </div>

    <!-- A full binder with a page count: later scans go to Unplaced (spec 007, AC-23) -->
    <p v-if="binderFull" class="absolute top-32 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-black" data-testid="binder-full">
      Binder full · new cards go to Unplaced
    </p>

    <!-- Status -->
    <p v-if="statusText" class="absolute top-20 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2 truncate rounded-full bg-black/70 px-4 py-1.5 text-sm whitespace-nowrap" data-testid="scan-status">
      {{ statusText }}
    </p>

    <!-- Loading the model (AC-3) -->
    <div v-if="status.kind === 'loading'" class="absolute inset-0 flex items-center justify-center bg-black/80 p-6" data-testid="scanner-loading">
      <div class="grid w-full max-w-xs gap-3 text-center">
        <p>{{ status.progress?.cached ? 'Loading the recognition model…' : 'Downloading the recognition model…' }}</p>
        <Progress :model-value="percent" />
        <p class="text-sm text-white/70">{{ percent }}%</p>
      </div>
    </div>

    <!-- Camera problems (AC-2) and errors -->
    <div v-else-if="camera.status.value === 'error' || status.kind === 'error'" class="absolute inset-0 flex items-center justify-center bg-black/85 p-6" data-testid="scanner-error">
      <div class="grid max-w-sm gap-4 text-center">
        <CameraOffIcon class="mx-auto size-10" />
        <p>{{ status.kind === 'error' ? status.message : CAMERA_HELP[camera.error.value!] }}</p>
        <Button variant="secondary" @click="scanner.resume()">Try again</Button>
      </div>
    </div>

    <!-- Paused after a minute without a card (AC-4) -->
    <button
      v-else-if="status.kind === 'paused'" type="button"
      class="absolute inset-0 flex items-center justify-center bg-black/70 text-lg" data-testid="scanner-paused"
      @click="tapToResume"
    >
      Camera paused · tap to resume
    </button>

    <!-- Last logged card (AC-11) -->
    <div class="absolute inset-x-0 bottom-0 grid gap-2 p-3 text-foreground" style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))">
      <!-- Best guesses for an unsure card (spec 019, AC-6) -->
      <GuessStrip v-if="guesses?.length" class="mx-auto w-full max-w-xl" :guesses="guesses" @pick="scanner.pick" @close="scanner.closeGuesses()" />
      <ResultBar
        v-if="lastScan || lastDeckCard" class="mx-auto w-full max-w-xl" :item="lastScan" :deck-card="lastDeckCard" :currency="currency"
        :place="lastSlot && binderGrid ? placeLabel(lastSlot, binderGrid.cols) : null"
        @plus="scanner.plusOne()" @undo="scanner.undo()" @finish="scanner.setFinish" @printing="editOpen = true"
      />
    </div>

    <ScannerSettingsSheet v-if="settings" v-model:open="settingsOpen" :settings="settings" :currency="currency" :ready="ready" :save="scanner.saveSettings" :camera="camera" />
    <EditItemDialog v-model:open="editOpen" :row="lastScan" @saved="onEdited" />
    <BinderScanDialog
      v-if="binderId && binderGrid" v-model:open="binderOpen" :current="binderScan" :rows="binderGrid.rows" :cols="binderGrid.cols"
      @confirm="changeBinderScan"
    />
    <ScanTargetDialog
      v-if="deck" v-model:open="targetOpen" :deck-id="deck.id" :box-id="deck.location" :current="target" action="Use"
      @confirm="changeTarget"
    />
  </div>
</template>
