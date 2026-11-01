<script setup lang="ts">
import { InfoIcon } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{ text: string }>()
</script>

<!-- Info icon with a tooltip, for extra context that shouldn't clutter the page. -->
<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        :aria-label="text"
        class="inline-flex text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        <InfoIcon class="size-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent class="max-w-xs text-pretty">{{ text }}</TooltipContent>
  </Tooltip>
</template>
