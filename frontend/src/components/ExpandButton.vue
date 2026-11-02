<script setup lang="ts">
import { Maximize2Icon } from '@lucide/vue'
import { showFullscreen } from '@/composables/useFullscreen'

/** Corner button that opens a card full screen. Put it inside a `group relative` wrapper (AC-18b). */
defineProps<{ image?: string | null; name: string }>()
</script>

<template>
  <button
    v-if="image"
    type="button"
    class="absolute top-1.5 right-1.5 z-10 rounded-md bg-background/90 p-1 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    :aria-label="`Preview ${name}`"
    data-testid="expand"
    @click.stop="showFullscreen(image, name)"
  >
    <Maximize2Icon class="size-3.5" />
  </button>
</template>
