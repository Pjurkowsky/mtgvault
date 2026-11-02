<script setup lang="ts">
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

/** Large card image on hover (AC-9, AC-32). Wraps whatever shows the card. */
defineProps<{ image?: string | null; name: string; disabled?: boolean }>()
</script>

<template>
  <HoverCard v-if="image && !disabled" :open-delay="350" :close-delay="0">
    <HoverCardTrigger as-child><slot /></HoverCardTrigger>
    <HoverCardContent side="right" class="w-auto border-none bg-transparent p-0 shadow-none">
      <img :src="image" :alt="name" class="w-64 rounded-[4.75%/3.5%] shadow-xl" data-testid="card-preview" />
    </HoverCardContent>
  </HoverCard>
  <slot v-else />
</template>
