<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { XIcon } from '@lucide/vue'
import { fullscreen, hideFullscreen } from '@/composables/useFullscreen'

// Escape closes only the preview: stop it before dialogs underneath see it.
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && fullscreen.image) {
    event.stopImmediatePropagation()
    event.preventDefault()
    hideFullscreen()
  }
}
onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <!-- pointer-events-auto: open dialogs disable pointer events on <body>. -->
    <div
      v-if="fullscreen.image"
      class="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
      role="dialog" aria-modal="true" :aria-label="fullscreen.name" data-testid="fullscreen"
      @click="hideFullscreen"
    >
      <img :src="fullscreen.image" :alt="fullscreen.name" class="max-h-full max-w-full rounded-[4.75%/3.5%] shadow-2xl" />
      <button type="button" class="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25" aria-label="Close preview">
        <XIcon class="size-5" />
      </button>
    </div>
  </Teleport>
</template>
