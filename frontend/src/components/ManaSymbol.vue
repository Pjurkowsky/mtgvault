<script setup lang="ts">
// Scryfall's mana symbols, bundled with the app (AC-20).
const files = import.meta.glob('@/assets/mana/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]))

defineProps<{ symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C' }>()
</script>

<template>
  <img :src="urls[symbol]" alt="" class="size-5" />
</template>
