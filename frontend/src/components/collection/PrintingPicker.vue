<script setup lang="ts">
import type { Schemas } from '@/api/client'
import { cn } from '@/lib/utils'

defineProps<{ printings: Schemas['Printing'][] }>()
const selected = defineModel<string | null>({ required: true })
</script>

<!-- Printings of one card as images, newest first (AC-22). -->
<template>
  <div role="radiogroup" aria-label="Printing" class="flex gap-3 overflow-x-auto pb-2" data-testid="printing-picker">
    <button
      v-for="p in printings" :key="p.id"
      type="button" role="radio" :aria-checked="selected === p.id"
      :aria-label="`${p.set_name} #${p.collector_number}`"
      class="w-24 shrink-0 text-left"
      @click="selected = p.id"
    >
      <img
        :src="p.image_small" :alt="p.name" loading="lazy"
        :class="cn('aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted',
                   selected === p.id ? 'ring-2 ring-primary ring-offset-2' : 'opacity-80 hover:opacity-100')"
      />
      <span class="mt-1 block truncate text-xs uppercase">{{ p.set_code }} #{{ p.collector_number }}</span>
    </button>
  </div>
</template>
