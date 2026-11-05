<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

/** A filter field with one checkbox per option. */
const props = defineProps<{ label: string; options: readonly { value: string; label: string }[]; selected: string[]; columns?: 1 | 2 }>()
const emit = defineEmits<{ change: [values: string[]] }>()
const toggle = (value: string, on: boolean) =>
  emit('change', on ? [...props.selected, value] : props.selected.filter((v) => v !== value))
</script>

<template>
  <section class="grid gap-2">
    <Label>{{ label }}</Label>
    <div :class="columns === 1 ? 'grid gap-1.5' : 'grid grid-cols-2 gap-x-3 gap-y-1.5'">
      <label v-for="o in options" :key="o.value" class="flex items-center gap-2 text-sm">
        <Checkbox :model-value="selected.includes(o.value)" @update:model-value="(on) => toggle(o.value, on === true)" />
        <slot name="option" :option="o">{{ o.label }}</slot>
      </label>
    </div>
  </section>
</template>
