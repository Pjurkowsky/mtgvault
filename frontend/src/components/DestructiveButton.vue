<script setup lang="ts">
import { Trash2Icon } from '@lucide/vue'
import { Button } from '@/components/ui/button'

/** Outlined button with red text and a trash icon, for removing things (spec 006, AC-4). */
defineProps<{ size?: 'sm' | 'default'; disabled?: boolean }>()
</script>

<template>
  <Button
    variant="outline" :size="size" :disabled="disabled"
    class="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
  >
    <Trash2Icon /> <slot />
  </Button>
</template>
