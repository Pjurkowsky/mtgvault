<script setup lang="ts">
// Scryfall's mana symbols, bundled with the app (AC-20).
const files = import.meta.glob('@/assets/mana/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]))

import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{ symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <img :src="urls[symbol]" alt="" :class="cn('size-5', $props.class)" />
</template>
