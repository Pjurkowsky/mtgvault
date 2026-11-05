<script setup lang="ts">
import ManaSymbol from '@/components/ManaSymbol.vue'
import { Label } from '@/components/ui/label'
import { Toggle } from '@/components/ui/toggle'
import { COLORS } from '@/lib/cards'

/** Color filter: one toggle per color symbol. */
const props = defineProps<{ selected: string[] }>()
const emit = defineEmits<{ change: [values: string[]] }>()
const toggle = (value: string, on: boolean) =>
  emit('change', on ? [...props.selected, value] : props.selected.filter((v) => v !== value))
</script>

<template>
  <section class="grid gap-2">
    <Label>Color</Label>
    <div class="flex flex-wrap gap-1">
      <Toggle
        v-for="c in COLORS" :key="c.value" size="sm" variant="outline"
        :model-value="selected.includes(c.value)" :aria-label="c.label"
        @update:model-value="(on: boolean) => toggle(c.value, on)"
      ><ManaSymbol :symbol="c.value" /></Toggle>
    </div>
  </section>
</template>
