<script setup lang="ts">
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import { showFullscreen } from '@/composables/useFullscreen'

type Token = Schemas['Token']

/**
 * Token images: hover for the large image. Click opens the Token dialog when `openable`
 * (a deck, spec 021 AC-9), else full screen (the card dialog, spec 015 AC-7).
 */
const props = withDefaults(defineProps<{ tokens: Token[]; size?: 'sm' | 'md'; openable?: boolean }>(), { size: 'md' })
const emit = defineEmits<{ open: [token: Token] }>()
function click(t: Token) {
  if (props.openable) emit('open', t)
  else showFullscreen(t.image_large || t.image_normal, t.name)
}
</script>

<template>
  <ul :class="size === 'sm' ? 'flex flex-wrap gap-2' : 'grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12'">
    <li v-for="t in tokens" :key="t.id" data-testid="token">
      <CardPreview :image="t.image_normal" :name="t.name">
        <button type="button" :aria-label="t.name" :class="size === 'sm' ? 'block w-20' : 'block w-full'" @click="click(t)">
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
