<script setup lang="ts">
import { computed } from 'vue'
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import { cn } from '@/lib/utils'

/** A card on the battlefield: image (or its name), sideways when tapped, with P/T and counters (AC-25). */
const props = defineProps<{ card: Schemas['BoardCard']; image?: Schemas['CardImage'] }>()
const counters = computed(() => Object.entries(props.card.counters ?? {}))
</script>

<template>
  <CardPreview :image="image?.image_normal" :name="card.name">
    <div
      :class="cn('relative w-14 shrink-0 transition-transform', card.tapped && 'mx-2.5 rotate-90')"
      :data-tapped="card.tapped || undefined" :aria-label="card.name" data-testid="board-card" tabindex="0"
    >
      <img v-if="image?.image_small" :src="image.image_small" :alt="card.name" loading="lazy" class="w-14 rounded-[4.75%/3.5%] bg-muted" />
      <div v-else class="flex aspect-[63/88] w-14 items-center rounded-[4.75%/3.5%] border bg-muted p-1 text-center text-[0.55rem] leading-tight">{{ card.name }}</div>
      <span v-if="card.power != null" class="absolute right-0 bottom-0 rounded-tl-sm bg-background/90 px-1 text-[0.6rem] font-semibold tabular-nums" data-testid="board-pt">{{ card.power }}/{{ card.toughness }}</span>
      <span v-for="([type, n], i) in counters" :key="type" class="absolute left-0 rounded-r-sm bg-primary px-1 text-[0.55rem] text-primary-foreground" :style="{ top: `${i * 0.9}rem` }" data-testid="board-counter">{{ n }} {{ type }}</span>
    </div>
  </CardPreview>
</template>
