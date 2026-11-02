<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CameraOffIcon, SettingsIcon, ShoppingCartIcon, XIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import EditItemDialog from '@/components/collection/EditItemDialog.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import ResultBar from '@/components/scanner/ResultBar.vue'
import ScannerSettingsSheet from '@/components/scanner/ScannerSettingsSheet.vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CAMERA_HELP } from '@/scanner/camera'
import { unlockAudio } from '@/scanner/sounds'
import { useScanner, type ScanItem } from '@/scanner/useScanner'
import { useAuthStore } from '@/stores/auth'

/** Full-screen scanner (spec 003). */
const router = useRouter()
const auth = useAuthStore()
const scanner = useScanner()
const { camera, status, settings, lastScan, cart, ready } = scanner
const currency = computed(() => auth.user?.currency ?? 'USD')
const settingsOpen = ref(false)
const editOpen = ref(false)

onMounted(() => void scanner.start())

const statusText = computed(() => {
  const s = status.value
  if (s.kind === 'looking') return 'Hold a card in view'
  if (s.kind === 'steady') return s.name ? `Hold steady… ${s.name}?` : 'Hold steady'
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
  router.push({ name: 'collection' })
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
      <IconButton label="Close scanner" variant="secondary" @click="close"><XIcon /></IconButton>
      <RouterLink
        :to="{ name: 'location', params: { id: 'cart' } }"
        class="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-sm text-foreground shadow"
        data-testid="cart-link"
      >
        <ShoppingCartIcon class="size-4" />
        <span>Cart</span>
        <span v-if="settings?.show_total && cart" data-testid="running-total" class="text-muted-foreground">
          {{ cards(cart.card_count) }} · <Price :value="cart.value" :values="cart.values" :currency="currency" />
        </span>
      </RouterLink>
      <div class="ml-auto">
        <IconButton label="Scanner settings" variant="secondary" :disabled="!settings" @click="settingsOpen = true"><SettingsIcon /></IconButton>
      </div>
    </div>

    <!-- Status -->
    <p v-if="statusText" class="absolute top-20 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm whitespace-nowrap" data-testid="scan-status">
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
    <div class="absolute inset-x-0 bottom-0 p-3 text-foreground" style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))">
      <ResultBar
        v-if="lastScan" class="mx-auto max-w-xl" :item="lastScan" :currency="currency"
        @plus="scanner.plusOne()" @undo="scanner.undo()" @finish="scanner.setFinish" @printing="editOpen = true"
      />
    </div>

    <ScannerSettingsSheet v-if="settings" v-model:open="settingsOpen" :settings="settings" :currency="currency" :ready="ready" :save="scanner.saveSettings" />
    <EditItemDialog v-model:open="editOpen" :row="lastScan" @saved="onEdited" />
  </div>
</template>
