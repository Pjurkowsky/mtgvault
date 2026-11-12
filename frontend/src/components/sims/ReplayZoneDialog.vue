<script setup lang="ts">
import type { Schemas } from '@/api/client'
import { showFullscreen } from '@/composables/useFullscreen'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * A player's hand, library, graveyard or exile as small images (spec 026, AC-2, AC-3, AC-8).
 * `cards` is null when the game didn't record them; `fresh` cards just arrived.
 */
defineProps<{
  title: string; zone: string; cards: { id: number; name: string }[] | null
  images: Record<string, Schemas['CardImage']>; fresh?: Set<number>
}>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-3xl" :data-testid="`zone-${zone}-dialog`">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ title }} cards</DialogDescription>
      </DialogHeader>
      <p v-if="cards === null" class="text-sm text-muted-foreground" data-testid="zone-unrecorded">The cards weren't recorded for this game.</p>
      <p v-else-if="!cards.length" class="text-sm text-muted-foreground">Empty</p>
      <ul v-else class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" :data-testid="`zone-${zone}-list`">
        <li v-for="c in cards" :key="c.id" :data-fresh="fresh?.has(c.id) || undefined" data-testid="zone-card">
          <button
            type="button" :aria-label="c.name"
            :class="cn('block w-full cursor-zoom-in rounded-[4.75%/3.5%]', fresh?.has(c.id) && 'ring-3 ring-amber-500 ring-offset-2 ring-offset-background')"
            @click="showFullscreen(images[c.name]?.image_normal, c.name)"
          >
            <img v-if="images[c.name]?.image_small" :src="images[c.name]!.image_small" :alt="c.name" loading="lazy" class="w-full rounded-[4.75%/3.5%] bg-muted" />
            <span v-else class="flex aspect-[63/88] w-full items-center rounded-[4.75%/3.5%] border bg-muted p-1 text-center text-xs leading-tight">{{ c.name }}</span>
          </button>
        </li>
      </ul>
    </DialogContent>
  </Dialog>
</template>
