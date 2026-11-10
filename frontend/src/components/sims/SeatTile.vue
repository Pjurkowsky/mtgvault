<script setup lang="ts">
import type { Opponent } from '@/lib/sims'

/** A deck at the table: commander art, name, commander and owner (AC-10). */
defineProps<{ pick: Opponent; button?: boolean; label?: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <component
    :is="button ? 'button' : 'div'" :type="button ? 'button' : undefined"
    class="flex min-w-0 items-center gap-2 rounded-md text-left" :class="button && 'hover:bg-muted'"
    :aria-label="button ? (label ?? `Change ${pick.name}`) : undefined" data-testid="seat-tile" @click="button && $emit('click')"
  >
    <img v-if="pick.image" :src="pick.image" alt="" class="h-12 w-16 shrink-0 rounded-sm object-cover" loading="lazy" />
    <div v-else class="h-12 w-16 shrink-0 rounded-sm bg-muted" />
    <div class="grid min-w-0 text-sm">
      <span class="truncate font-medium">{{ pick.name }}</span>
      <span class="truncate text-xs text-muted-foreground">{{ pick.commanders.join(' & ') }} · {{ pick.owner }}</span>
    </div>
  </component>
</template>
