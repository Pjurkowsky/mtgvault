<script setup lang="ts">
import ManaSymbol from '@/components/ManaSymbol.vue'
import { Label } from '@/components/ui/label'
import { Toggle } from '@/components/ui/toggle'
import { COLORS } from '@/lib/cards'

/** Color filter: one toggle per color symbol. A selected one is ringed; once any is, the others fade (spec 009, AC-12). */
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
        :class="selected.includes(c.value) ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : selected.length ? 'opacity-40' : ''"
        @update:model-value="(on: boolean) => toggle(c.value, on)"
      ><ManaSymbol :symbol="c.value" /></Toggle>
    </div>
  </section>
</template>
