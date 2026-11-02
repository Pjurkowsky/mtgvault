<script setup lang="ts">
import type { Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import ExpandButton from '@/components/ExpandButton.vue'
import { cn } from '@/lib/utils'

defineProps<{ printings: Schemas['Printing'][] }>()
const selected = defineModel<string | null>({ required: true })
</script>

<!-- Printings of one card as images, newest first, with a hover preview (spec 001 AC-22, spec 002 AC-18a). -->
<template>
  <div role="radiogroup" aria-label="Printing" class="flex gap-3 overflow-x-auto pb-2" data-testid="printing-picker">
    <div v-for="p in printings" :key="p.id" class="group relative shrink-0">
    <CardPreview :image="p.image_normal" :name="p.name">
    <button
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
    </CardPreview>
    <ExpandButton :image="p.image_large || p.image_normal" :name="`${p.name} (${p.set_name})`" />
    </div>
  </div>
</template>
