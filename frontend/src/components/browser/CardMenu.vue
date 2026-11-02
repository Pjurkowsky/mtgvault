<script setup lang="ts">
import { EyeIcon, LayersIcon, PencilIcon, Trash2Icon } from '@lucide/vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

/** Right-click (long-press on touch) menu for a card (spec 002, AC-18). */
defineProps<{ editable: boolean }>()
const emit = defineEmits<{ open: []; edit: []; delete: []; deck: [] }>()
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child><slot /></ContextMenuTrigger>
    <ContextMenuContent data-testid="card-menu">
      <ContextMenuItem @select="emit('open')"><EyeIcon /> Open</ContextMenuItem>
      <template v-if="editable">
        <ContextMenuItem @select="emit('edit')"><PencilIcon /> Edit</ContextMenuItem>
        <ContextMenuItem @select="emit('deck')"><LayersIcon /> Add to deck</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" @select="emit('delete')"><Trash2Icon /> Delete</ContextMenuItem>
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>
