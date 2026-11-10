<script setup lang="ts">
import type { Schemas } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

/** The commander's most played EDHREC themes (spec 022, AC-15). */
defineProps<{ themes: Schemas['DeckTheme'][] }>()
const decks = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'deck' : 'decks'} on EDHREC`
</script>

<template>
  <Card class="gap-3 p-4" data-testid="themes">
    <h3 class="text-sm font-semibold">Commander themes</h3>
    <ul class="flex flex-wrap gap-2">
      <li v-for="theme in themes" :key="theme.url">
        <Badge as-child variant="outline" class="py-1 text-sm font-normal">
          <a :href="theme.url" target="_blank" rel="noopener" :title="decks(theme.count)" data-testid="theme">
            {{ theme.name }} <span class="text-muted-foreground tabular-nums">{{ theme.count.toLocaleString() }}</span>
          </a>
        </Badge>
      </li>
    </ul>
  </Card>
</template>
