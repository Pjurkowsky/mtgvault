<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import type { BrowserRow } from '@/components/browser/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DragSource } from '@/composables/useBinderDrag'
import { usePreference } from '@/composables/usePreference'
import UnplacedTray from './UnplacedTray.vue'
import { useDock } from './useDock'

/**
 * The Unplaced sidebar on the window's right edge (spec 009, AC-7, AC-8): an arrow
 * tab shows and hides it, remembered. On wide screens the whole page makes room
 * for it, like a docked panel; on phones it lies over the page. A binder location
 * shows it in every view, so switching views moves nothing.
 */
const props = defineProps<{
  unplaced: { row: BrowserRow; count: number }[]
  over: boolean
  q: string
  /** Open for now without changing the remembered choice (a drag from a pocket). */
  forceOpen?: boolean
  /** Cards can be dragged from it (binder view only). */
  draggable?: boolean
}>()
const emit = defineEmits<{ open: [row: BrowserRow]; drag: [source: DragSource, event: PointerEvent] }>()

// Phones start with it closed: open, it covers the page.
const wideScreen = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches
const pref = usePreference('binder.tray', wideScreen ? 'open' : 'closed', ['open', 'closed'] as const)
const shown = computed(() => pref.value === 'open' || !!props.forceOpen)
const toggle = () => (pref.value = shown.value ? 'closed' : 'open')

const { width } = useWindowSize()
const docked = computed(() => shown.value && width.value >= 768)
const { dock, release } = useDock()
watch(docked, dock, { immediate: true })
onBeforeUnmount(release)
</script>

<template>
  <!-- Slides in from the window's edge (motion-reduce: no slide) -->
  <Transition
    enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    enter-from-class="translate-x-full"
    leave-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
    leave-to-class="translate-x-full"
  >
    <aside
      v-if="shown" class="fixed inset-y-0 right-0 z-30 w-72 border-l bg-card shadow-xl"
      data-testid="unplaced-sidebar" data-state="open"
    >
      <UnplacedTray
        id="unplaced-tray" class="h-full overflow-y-auto"
        :unplaced="unplaced" :editable="!!draggable" :over="over" :q="q"
        @open="emit('open', $event)" @drag="(s, e) => emit('drag', s, e)"
      />
    </aside>
  </Transition>
  <span v-if="!shown" class="hidden" data-testid="unplaced-sidebar" data-state="closed" />
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="fixed top-1/2 z-30 flex -translate-y-1/2 items-center rounded-l-xl border border-r-0 bg-background px-1.5 py-6 text-muted-foreground shadow-lg transition-[right,color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted motion-reduce:transition-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        :class="shown ? 'right-72' : 'right-0'"
        :aria-label="shown ? 'Hide Unplaced' : 'Show Unplaced'" :aria-expanded="shown" aria-controls="unplaced-tray"
        data-testid="unplaced-tab" @click="toggle"
      >
        <ChevronRightIcon v-if="shown" class="size-6" />
        <ChevronLeftIcon v-else class="size-6" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="left">{{ shown ? 'Hide Unplaced' : 'Show Unplaced' }}</TooltipContent>
  </Tooltip>
</template>
