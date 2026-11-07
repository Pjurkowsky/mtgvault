<script setup lang="ts">
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import { showFullscreen } from '@/composables/useFullscreen'

type Token = Schemas['Token'] & { caption?: string }

/** Token images: hover for the large image (and who makes it), click for full screen (spec 015, AC-3, AC-7). */
withDefaults(defineProps<{ tokens: Token[]; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <ul :class="size === 'sm' ? 'flex flex-wrap gap-2' : 'grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7'">
    <li v-for="t in tokens" :key="t.id" data-testid="token">
      <CardPreview :image="t.image_normal" :name="t.name" :caption="t.caption">
        <button
          type="button" :aria-label="t.name" :class="size === 'sm' ? 'block w-20' : 'block w-full'"
          @click="showFullscreen(t.image_large || t.image_normal, t.name)"
        >
          <img
            v-if="t.image_small" :src="t.image_small" :alt="t.name" loading="lazy"
            class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted"
          />
          <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ t.name }}</span>
        </button>
      </CardPreview>
    </li>
  </ul>
</template>
