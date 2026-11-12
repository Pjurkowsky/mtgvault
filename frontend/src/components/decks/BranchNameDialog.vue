<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** A branch's name: new branch, branch from a version, rename (spec 027, AC-3, AC-4, AC-9). */
const props = defineProps<{
  title: string
  description?: string
  action: string
  initial?: string
  /** Resolves to field errors, or null when saved. */
  save: (name: string) => Promise<Record<string, string> | null>
}>()
const open = defineModel<boolean>('open', { required: true })
const name = ref('')
const errors = ref<Record<string, string>>({})
const busy = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.initial ?? ''
  errors.value = {}
})

async function submit() {
  busy.value = true
  const result = await props.save(name.value)
  busy.value = false
  if (result) return (errors.value = result)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm" data-testid="branch-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <form id="branch-name" novalidate class="grid gap-2" @submit.prevent="submit">
        <Label for="branch-name-input">Name</Label>
        <Input id="branch-name-input" v-model="name" maxlength="40" autofocus />
        <p v-if="errors.name || errors.detail" class="text-sm text-destructive">{{ errors.name || errors.detail }}</p>
      </form>
      <DialogFooter><Button type="submit" form="branch-name" :disabled="busy">{{ action }}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
