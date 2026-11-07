<script setup lang="ts">
import { computed } from 'vue'
import { CameraIcon, InboxIcon, PlusIcon } from '@lucide/vue'
import CardMenu, { type MenuItem } from '@/components/browser/CardMenu.vue'
import type { BrowserRow } from '@/components/browser/types'
import CardPreview from '@/components/CardPreview.vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DragSource } from '@/composables/useBinderDrag'
import { placeKey, slotNumber, type BinderSlot, type Place } from '@/lib/binder'

/** One pocket: an empty pocket with its menu, or its card(s) (spec 007, AC-2, AC-14, AC-19). */
const props = defineProps<{
  place: Place
  cols: number
  stack: BinderSlot[] // top first
  items: Map<number, BrowserRow>
  editable: boolean
  hasUnplaced: boolean
  over: boolean
  dragging: boolean
  /** Search (spec 009, AC-5): true rings it, false fades it, null without a search. */
  match: boolean | null
  current: boolean
}>()
const emit = defineEmits<{
  open: [row: BrowserRow]
  stack: [place: Place]
  edit: [row: BrowserRow]
  delete: [row: BrowserRow]
  deck: [row: BrowserRow]
  move: [slot: BinderSlot]
  unplace: [slot: BinderSlot]
  add: [place: Place]
  'from-unplaced': [place: Place]
  scan: [place: Place]
  drag: [source: DragSource, event: PointerEvent]
}>()

const top = computed(() => props.stack[0] ?? null)
const item = computed(() => (top.value ? props.items.get(top.value.item) ?? null : null))
// The pocket's own copy: edit and delete leave its twins alone (spec 018, AC-1, AC-3).
const row = computed<BrowserRow | null>(() => (item.value && top.value ? { ...item.value, pocket: top.value.id } : null))
const number = computed(() => slotNumber(props.place, props.cols))
const label = computed(() => `Page ${props.place.page}, slot ${number.value}${row.value ? `: ${row.value.printing.name}` : ''}`)
const preview = computed(() =>
  props.stack.length > 1
    ? props.stack.map((s) => props.items.get(s.item)).filter((r): r is BrowserRow => !!r)
      .map((r) => ({ image: r.printing.image_normal, name: r.printing.name }))
    : undefined,
)
const MENU: MenuItem[] = ['open', 'edit', 'slot', 'unplace', 'deck', 'delete']

function click() {
  if (props.stack.length > 1) emit('stack', props.place)
  else if (row.value) emit('open', row.value)
}
function press(event: PointerEvent) {
  if (!props.editable || !top.value || !row.value) return
  emit('drag', { slot: top.value.id, image: row.value.printing.image_normal, name: row.value.printing.name }, event)
}
</script>

<template>
  <div
    class="relative aspect-[488/680] rounded-[4.75%/3.5%] transition-shadow"
    :class="[
      (over || match) && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      current && 'ring-4',
      match === false && 'opacity-25',
      !top && 'border border-dashed border-muted-foreground/30 bg-muted/40',
    ]"
    :data-match="match === null ? undefined : match ? (current ? 'current' : 'hit') : 'miss'"
    :data-drop="editable ? placeKey(place) : undefined" :data-place="placeKey(place)" :data-state="top ? 'filled' : 'empty'"
    data-testid="binder-slot"
  >
    <template v-if="top && row">
      <CardMenu
        :editable="editable" :items="editable ? MENU : ['open']"
        @open="emit('open', row)" @edit="emit('edit', row)" @delete="emit('delete', row)" @deck="emit('deck', row)"
        @slot="emit('move', top)" @unplace="emit('unplace', top)"
      >
        <CardPreview :image="row.printing.image_normal" :name="row.printing.name" :stack="preview" :disabled="dragging">
          <button
            type="button" class="block size-full touch-manipulation overflow-hidden rounded-[4.75%/3.5%] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :aria-label="label" @click="click" @pointerdown="press"
          >
            <img :src="row.printing.image_normal" :alt="row.printing.name" loading="lazy" draggable="false" class="size-full object-cover" />
          </button>
        </CardPreview>
      </CardMenu>
      <span
        v-if="stack.length > 1"
        class="pointer-events-none absolute top-1 right-1 rounded-md bg-background/90 px-1.5 text-xs font-semibold shadow" data-testid="stack-count"
      >+{{ stack.length - 1 }}</span>
      <Tooltip v-if="top.mismatch">
        <TooltipTrigger as-child>
          <span class="absolute bottom-1 left-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-background" data-testid="mismatch" aria-label="Outside this section" />
        </TooltipTrigger>
        <TooltipContent>Outside this section's filter</TooltipContent>
      </Tooltip>
    </template>

    <DropdownMenu v-else-if="editable">
      <DropdownMenuTrigger as-child>
        <button type="button" class="flex size-full items-center justify-center rounded-[4.75%/3.5%] text-xs text-muted-foreground/60 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" :aria-label="`${label}: empty`">
          {{ number }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem @select="emit('add', place)"><PlusIcon /> Add card…</DropdownMenuItem>
        <DropdownMenuItem :disabled="!hasUnplaced" @select="emit('from-unplaced', place)"><InboxIcon /> From Unplaced…</DropdownMenuItem>
        <DropdownMenuItem @select="emit('scan', place)"><CameraIcon /> Scan from here</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <span v-else class="flex size-full items-center justify-center text-xs text-muted-foreground/60" :aria-label="`${label}: empty`">{{ number }}</span>
  </div>
</template>
