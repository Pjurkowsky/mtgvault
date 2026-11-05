<script setup lang="ts">
import ExpandButton from '@/components/ExpandButton.vue'
import { cn } from '@/lib/utils'

/**
 * One card image tile: quantity badge, name and price on hover (spec 002, AC-17),
 * optional fullscreen button. Used by the collection grid and the deck's Images view.
 */
defineProps<{
  image: string | null | undefined
  name: string
  quantity: number
  label: string
  selected?: boolean
  /** Large image for the fullscreen button. */
  large?: string | null
}>()
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <div class="relative">
  <button
    type="button"
    class="relative block w-full overflow-hidden rounded-[4.75%/3.5%] text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    :aria-label="label"
    data-testid="card-tile"
    :data-selected="selected || undefined"
    @click="emit('click', $event)"
  >
    <img
      :src="image ?? undefined"
      :alt="name"
      loading="lazy"
      :class="cn('aspect-[488/680] w-full bg-muted object-cover transition', selected && 'scale-[0.94] rounded-[4.75%/3.5%]')"
    />
    <span class="absolute top-2 left-2 flex gap-1">
      <span class="rounded-md bg-background/90 px-1.5 text-sm font-semibold shadow" data-testid="card-quantity">×{{ quantity }}</span>
      <slot name="badges" />
    </span>
    <span class="absolute right-2 bottom-2"><slot name="corner" /></span>
    <span
      class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      data-testid="card-hover"
    >
      <span class="truncate font-medium">{{ name }}</span>
      <slot name="price" />
    </span>
  </button>
  <ExpandButton v-if="large !== undefined" :image="large" :name="name" />
  </div>
</template>
