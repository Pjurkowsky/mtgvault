<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import type { ButtonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Icon-only button that always has a tooltip and an accessible name (AC-6). */
withDefaults(defineProps<{ label: string; variant?: ButtonVariants['variant']; size?: ButtonVariants['size'] }>(), {
  variant: 'outline',
  size: 'icon',
})
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button :variant="variant" :size="size" :aria-label="label" v-bind="$attrs"><slot /></Button>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>
