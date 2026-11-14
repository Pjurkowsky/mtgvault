<script setup lang="ts">
import type { Schemas } from '@/api/client'
import CardSizeToggle from '@/components/CardSizeToggle.vue'
import { usePreference } from '@/composables/usePreference'
import { CARD_SIZES, GRID_COLUMNS, type CardSize } from '@/lib/cards'
import { showFullscreen } from '@/composables/useFullscreen'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * A player's hand, library, graveyard or exile as card images, nearly full screen, in the
 * chosen card size, remembered (spec 026, AC-2, AC-3, AC-8).
 * `cards` is null when the game didn't record them; `fresh` cards just arrived.
 */
defineProps<{
  title: string; zone: string; cards: { id: number; name: string }[] | null
  images: Record<string, Schemas['CardImage']>; fresh?: Set<number>
}>()
const open = defineModel<boolean>('open', { default: false })
const size = usePreference<CardSize>('replay.zone-size', 'md', CARD_SIZES)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex h-[90vh] max-w-[95vw] flex-col sm:max-w-[min(110rem,95vw)]" :data-testid="`zone-${zone}-dialog`">
      <DialogHeader class="flex-row flex-wrap items-center gap-3 pr-8">
        <DialogTitle>{{ title }} <span class="text-muted-foreground tabular-nums">{{ cards?.length ?? '' }}</span></DialogTitle>
        <DialogDescription class="sr-only">{{ title }} cards</DialogDescription>
        <CardSizeToggle v-if="cards?.length" v-model="size" class="ml-auto" />
      </DialogHeader>
      <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-2">
      <p v-if="cards === null" class="text-sm text-muted-foreground" data-testid="zone-unrecorded">The cards weren't recorded for this game.</p>
      <p v-else-if="!cards.length" class="text-sm text-muted-foreground">Empty</p>
      <ul v-else :class="cn('grid gap-3', GRID_COLUMNS[size])" :data-size="size" :data-testid="`zone-${zone}-list`">
        <li v-for="c in cards" :key="c.id" :data-fresh="fresh?.has(c.id) || undefined" data-testid="zone-card">
          <button
            type="button" :aria-label="c.name"
            :class="cn('block w-full cursor-zoom-in rounded-[4.75%/3.5%]', fresh?.has(c.id) && 'ring-3 ring-amber-500 ring-offset-2 ring-offset-background')"
            @click="showFullscreen(images[c.name]?.image_normal, c.name)"
          >
            <img
              v-if="images[c.name]?.image_normal || images[c.name]?.image_small" :src="images[c.name]!.image_normal || images[c.name]!.image_small"
              :alt="c.name" loading="lazy" class="w-full rounded-[4.75%/3.5%] bg-muted"
            />
            <span v-else class="flex aspect-[63/88] w-full items-center rounded-[4.75%/3.5%] border bg-muted p-1 text-center text-xs leading-tight">{{ c.name }}</span>
          </button>
        </li>
      </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
