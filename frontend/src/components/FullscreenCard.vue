<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RefreshCwIcon, XIcon } from '@lucide/vue'
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
      <img
        :src="fullscreen.flipped && fullscreen.back ? fullscreen.back : fullscreen.image" :alt="fullscreen.name"
        class="max-h-full max-w-full rounded-[4.75%/3.5%] shadow-2xl" :data-face="fullscreen.flipped ? 'back' : 'front'" data-testid="fullscreen-image"
      />
      <!-- Spec 023, AC-16 -->
      <button
        v-if="fullscreen.back" type="button" class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
        data-testid="turn-over" @click.stop="fullscreen.flipped = !fullscreen.flipped"
      >
        <RefreshCwIcon class="size-4" /> Turn over
      </button>
      <button type="button" class="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25" aria-label="Close preview">
        <XIcon class="size-5" />
      </button>
    </div>
  </Teleport>
</template>
