<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { XIcon } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useCategorySuggestions } from '@/lib/categories'

/** Chips for a deck card's categories; the first is primary (spec 006, AC-12, AC-13). */
const props = defineProps<{ modelValue: string[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [names: string[]] }>()

// Our own copy updates at once, so quick edits build on each other before the save returns.
const names = ref<string[]>([...props.modelValue])
watch(() => props.modelValue, (v) => (names.value = [...v]))
function set(next: string[]) {
  names.value = next
  emit('update:modelValue', next)
}

const text = ref('')
const all = useCategorySuggestions()
const has = (name: string) => names.value.some((n) => n.toLowerCase() === name.toLowerCase())
const matching = computed(() => {
  const q = text.value.trim().toLowerCase()
  return all.value.filter((n) => !has(n) && (!q || n.toLowerCase().includes(q))).slice(0, 8)
})

function add(name: string) {
  const clean = name.trim().replace(/\s+/g, ' ')
  text.value = ''
  if (clean && !has(clean)) set([...names.value, clean])
}
const remove = (name: string) => set(names.value.filter((n) => n !== name))
function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add(text.value)
  } else if (event.key === 'Backspace' && !text.value && names.value.length) {
    remove(names.value[names.value.length - 1]!)
  }
}
</script>

<template>
  <div class="grid gap-2" data-testid="category-input">
    <ul v-if="names.length" class="flex flex-wrap gap-1.5">
      <li v-for="(name, i) in names" :key="name">
        <Badge :variant="i === 0 ? 'default' : 'secondary'" class="gap-1 pr-1" data-testid="category-chip">
          {{ name }}
          <button type="button" class="rounded-sm opacity-70 hover:opacity-100" :aria-label="`Remove ${name}`" :disabled="disabled" @click="remove(name)">
            <XIcon class="size-3" />
          </button>
        </Badge>
      </li>
    </ul>
    <Input v-model="text" placeholder="Add a category" aria-label="Add category" autocomplete="off" :disabled="disabled" @keydown="onKey" />
    <div v-if="matching.length" class="flex flex-wrap gap-1.5">
      <button
        v-for="name in matching" :key="name" type="button" :disabled="disabled"
        class="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="add(name)"
      >+ {{ name }}</button>
    </div>
  </div>
</template>
