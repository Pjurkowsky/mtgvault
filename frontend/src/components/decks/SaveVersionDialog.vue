<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/** Save version: an optional name and note (spec 027, AC-7). */
const props = defineProps<{ branch: string; save: (name: string, note: string) => Promise<boolean> }>()
const open = defineModel<boolean>('open', { required: true })
const name = ref('')
const note = ref('')
const busy = ref(false)
watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  note.value = ''
})

async function submit() {
  busy.value = true
  const ok = await props.save(name.value, note.value)
  busy.value = false
  if (ok) open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm" data-testid="save-version-dialog">
      <DialogHeader>
        <DialogTitle>Save version</DialogTitle>
        <DialogDescription>{{ props.branch }}</DialogDescription>
      </DialogHeader>
      <form id="save-version" novalidate class="grid gap-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="version-name">Name</Label>
          <Input id="version-name" v-model="name" maxlength="60" placeholder="Optional" autofocus />
        </div>
        <div class="grid gap-2">
          <Label for="version-note">Note</Label>
          <Textarea id="version-note" v-model="note" maxlength="1000" placeholder="Optional" rows="3" />
        </div>
      </form>
      <DialogFooter><Button type="submit" form="save-version" :disabled="busy">Save</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
