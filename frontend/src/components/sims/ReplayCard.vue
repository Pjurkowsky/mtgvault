<script setup lang="ts">
import { computed } from 'vue'
import { SkullIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import { showFullscreen } from '@/composables/useFullscreen'
import { cn } from '@/lib/utils'

/**
 * A card on the battlefield: image (or its name), sideways when tapped, with P/T and counters (spec 024, AC-25).
 * Spec 026: a click shows it full screen (AC-4); attackers and blockers are marked (AC-6); a card that
 * just died stays faded with a skull (AC-7).
 */
const props = defineProps<{ card: Schemas['BoardCard']; image?: Schemas['CardImage']; ghost?: boolean }>()
const counters = computed(() => Object.entries(props.card.counters ?? {}))
const open = () => showFullscreen(props.image?.image_normal, props.card.name)
</script>

<template>
  <CardPreview :image="image?.image_normal" :name="card.name">
    <div
      :class="cn(
        'relative w-14 shrink-0 cursor-zoom-in rounded-[4.75%/3.5%] transition-transform',
        card.tapped && 'mx-2.5 rotate-90',
        card.attacking && 'ring-2 ring-destructive ring-offset-1 ring-offset-background',
        card.blocking && 'ring-2 ring-sky-500 ring-offset-1 ring-offset-background',
        ghost && 'opacity-40 grayscale',
      )"
      :data-tapped="card.tapped || undefined" :data-card-id="card.id" :data-ghost="ghost || undefined"
      :data-attacking="card.attacking ? 'true' : undefined" :data-blocking="card.blocking ? 'true' : undefined"
      :aria-label="ghost ? `${card.name}, died` : card.name" :data-testid="ghost ? 'board-ghost' : 'board-card'"
      role="button" tabindex="0" @click="open" @keydown.enter="open"
    >
      <img v-if="image?.image_small" :src="image.image_small" :alt="card.name" loading="lazy" class="w-14 rounded-[4.75%/3.5%] bg-muted" />
      <div v-else class="flex aspect-[63/88] w-14 items-center rounded-[4.75%/3.5%] border bg-muted p-1 text-center text-[0.55rem] leading-tight">{{ card.name }}</div>
      <span v-if="card.power != null" class="absolute right-0 bottom-0 rounded-tl-sm bg-background/90 px-1 text-[0.6rem] font-semibold tabular-nums" data-testid="board-pt">{{ card.power }}/{{ card.toughness }}</span>
      <span v-for="([type, n], i) in counters" :key="type" class="absolute left-0 rounded-r-sm bg-primary px-1 text-[0.55rem] text-primary-foreground" :style="{ top: `${i * 0.9}rem` }" data-testid="board-counter">{{ n }} {{ type }}</span>
      <SkullIcon v-if="ghost" class="absolute inset-0 m-auto size-7 rounded-full bg-background/80 p-1 text-foreground" aria-hidden="true" />
    </div>
  </CardPreview>
</template>
