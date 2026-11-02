<script setup lang="ts">
import { computed } from 'vue'
import symbolFiles from '@/assets/mana/symbols.json'

// Scryfall's mana symbols, bundled (src/assets/mana, symbols.json maps {X} -> file).
const urls = import.meta.glob('@/assets/mana/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const byFile = Object.fromEntries(Object.entries(urls).map(([path, url]) => [path.split('/').pop()!, url]))

const props = defineProps<{ cost: string }>()
// Double-faced cards: the front face's cost.
const symbols = computed(() => (props.cost.split(' // ')[0] ?? '').match(/\{[^}]+\}/g) ?? [])
const url = (symbol: string) => byFile[(symbolFiles as Record<string, string>)[symbol] ?? '']
</script>

<template>
  <span class="inline-flex items-center gap-px" :aria-label="cost" data-testid="mana-cost">
    <template v-for="(s, i) in symbols" :key="i">
      <img v-if="url(s)" :src="url(s)" alt="" class="size-3.5" />
      <span v-else class="text-xs">{{ s }}</span>
    </template>
  </span>
</template>
