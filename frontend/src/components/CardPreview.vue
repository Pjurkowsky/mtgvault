<script setup lang="ts">
import { ref } from 'vue'
import { Slot } from 'reka-ui'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

/** Large card image on hover (AC-9, AC-32). Wraps whatever shows the card. */
/** `stack`: every card of a shared binder pocket, shown side by side (spec 007, AC-19). */
defineProps<{ image?: string | null; name: string; disabled?: boolean; stack?: { image: string; name: string }[] }>()
// Listeners from a wrapping trigger (the card menu) reach the card itself.
defineOptions({ inheritAttrs: false })

// A click opens a dialog over the card, a right-click its menu: no preview until the pointer leaves.
// Only while the pointer is on the card: focus coming back from a menu or dialog must not open it
// (it would sit under the next dialog and take its Escape).
const open = ref(false)
const clicked = ref(false)
const hovering = ref(false)
// Never while a button is held or a card is dragged (spec 009, AC-9).
const pressed = ref(false)
function press() {
  pressed.value = true
  open.value = false
  window.addEventListener('pointerup', () => (pressed.value = false), { once: true })
}
const dragging = () => document.body.dataset.dragging !== undefined
function want(v: boolean) {
  open.value = v && hovering.value && !pressed.value && !dragging()
}
function suppress() {
  clicked.value = true
  open.value = false
}
// Arrow keys moved here (spec 011, AC-2): show it at once, until focus leaves.
function navigated() {
  if (dragging()) return
  clicked.value = false
  open.value = true
}
function blurred() {
  if (!hovering.value) open.value = false
}
function release() {
  hovering.value = false
  clicked.value = false
  open.value = false
}
</script>

<template>
  <HoverCard v-if="image && !disabled" :open="open && !clicked" :open-delay="800" :close-delay="0" @update:open="want">
    <HoverCardTrigger as-child v-bind="$attrs" @click="suppress" @contextmenu="suppress" @pointerdown="press" @pointerenter="hovering = true" @pointerleave="release" @cardnav="navigated" @blur="blurred"><slot /></HoverCardTrigger>
    <HoverCardContent side="right" class="w-auto border-none bg-transparent p-0 shadow-none">
      <div v-if="stack?.length" class="flex gap-2" data-testid="stack-preview">
        <img v-for="(c, i) in stack" :key="i" :src="c.image" :alt="c.name" class="w-48 rounded-[4.75%/3.5%] shadow-xl" data-testid="card-preview" />
      </div>
      <img v-else :src="image" :alt="name" class="w-64 rounded-[4.75%/3.5%] shadow-xl" data-testid="card-preview" />
    </HoverCardContent>
  </HoverCard>
  <Slot v-else v-bind="$attrs"><slot /></Slot>
</template>
