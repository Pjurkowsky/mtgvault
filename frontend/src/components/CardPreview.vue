<script setup lang="ts">
import { ref } from 'vue'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

/** Large card image on hover (AC-9, AC-32). Wraps whatever shows the card. */
defineProps<{ image?: string | null; name: string; disabled?: boolean }>()

// A click opens a dialog over the card: no preview until the pointer leaves.
const open = ref(false)
const clicked = ref(false)
</script>

<template>
  <HoverCard v-if="image && !disabled" :open="open && !clicked" :open-delay="350" :close-delay="0" @update:open="(v) => (open = v)">
    <HoverCardTrigger as-child @click="clicked = true" @pointerleave="clicked = false"><slot /></HoverCardTrigger>
    <HoverCardContent side="right" class="w-auto border-none bg-transparent p-0 shadow-none">
      <img :src="image" :alt="name" class="w-64 rounded-[4.75%/3.5%] shadow-xl" data-testid="card-preview" />
    </HoverCardContent>
  </HoverCard>
  <slot v-else />
</template>
