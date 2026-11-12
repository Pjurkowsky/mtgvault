<script setup lang="ts">
import { computed } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import { showFullscreen } from '@/composables/useFullscreen'
import type { Segment } from '@/lib/replay'

/**
 * An event's text with its card names underlined: hover shows the card, click shows it full
 * screen (spec 026, AC-14). `plain` only marks the names (inside a card's own preview).
 */
const props = defineProps<{ text: string; split: (text: string) => Segment[]; images: Record<string, Schemas['CardImage']>; plain?: boolean }>()
const segments = computed(() => props.split(props.text))
</script>

<template>
  <template v-for="(s, i) in segments" :key="i">
    <template v-if="!s.card">{{ s.text }}</template>
    <span v-else-if="plain" class="font-semibold">{{ s.text }}</span>
    <CardPreview v-else :image="images[s.card]?.image_normal" :name="s.card">
      <span
        class="cursor-zoom-in underline decoration-dotted underline-offset-2" :data-card="s.card" data-testid="event-card"
        @click.stop="showFullscreen(images[s.card]?.image_normal, s.card)"
      >{{ s.text }}</span>
    </CardPreview>
  </template>
</template>
