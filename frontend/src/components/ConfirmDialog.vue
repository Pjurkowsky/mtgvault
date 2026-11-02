<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { confirmState, settleConfirm } from '@/composables/useConfirm'
</script>

<!-- Every delete confirms here (spec 002, AC-5). -->
<template>
  <AlertDialog :open="confirmState.open" @update:open="(open) => !open && settleConfirm(false)">
    <AlertDialogContent data-testid="confirm-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ confirmState.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="confirmState.description">{{ confirmState.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="settleConfirm(false)">Cancel</AlertDialogCancel>
        <Button :variant="confirmState.destructive ? 'destructive' : 'default'" @click="settleConfirm(true)">
          {{ confirmState.action }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
