<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRightIcon, EyeIcon, HeartIcon, LayersIcon, PencilIcon, TagsIcon, Trash2Icon } from '@lucide/vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export type MenuItem = 'open' | 'edit' | 'categories' | 'deck' | 'swap' | 'want' | 'delete'

/**
 * Right-click (long-press on touch) menu for a card (spec 002, AC-18). The card
 * browser shows Open, Edit, Add to deck, Delete; a deck shows Edit, Propose swap,
 * Delete (spec 005, AC-7).
 */
const props = defineProps<{ editable: boolean; items?: MenuItem[] }>()
const emit = defineEmits<{ open: []; edit: []; categories: []; delete: []; deck: []; swap: [] }>()

const LABELS: Record<MenuItem, { label: string; icon: unknown }> = {
  open: { label: 'Open', icon: EyeIcon },
  edit: { label: 'Edit', icon: PencilIcon },
  categories: { label: 'Categories…', icon: TagsIcon },
  deck: { label: 'Add to deck', icon: LayersIcon },
  swap: { label: 'Propose swap', icon: ArrowLeftRightIcon },
  // The want list comes later (spec 005 AC-14, spec 006 AC-8).
  want: { label: 'Add to want list', icon: HeartIcon },
  delete: { label: 'Delete', icon: Trash2Icon },
}
const shown = computed<MenuItem[]>(() => props.items ?? (props.editable ? ['open', 'edit', 'deck', 'delete'] : ['open']))
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child><slot /></ContextMenuTrigger>
    <ContextMenuContent data-testid="card-menu">
      <template v-for="item in shown" :key="item">
        <ContextMenuSeparator v-if="item === 'delete' && shown.length > 1" />
        <ContextMenuItem :variant="item === 'delete' ? 'destructive' : 'default'" :disabled="item === 'want'" @select="emit(item as 'open')">
          <component :is="LABELS[item].icon" /> {{ LABELS[item].label }}
        </ContextMenuItem>
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>
