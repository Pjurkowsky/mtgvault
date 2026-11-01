<script setup lang="ts">
import { ref, watch } from 'vue'
import { CopyIcon, DownloadIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ load: () => Promise<{ text: string; rows: number } | undefined>; filename: string }>()
const open = defineModel<boolean>('open', { required: true })

const text = ref('')
const rows = ref(0)

watch(open, async (isOpen) => {
  if (!isOpen) return
  text.value = ''
  const data = await props.load()
  text.value = data?.text ?? ''
  rows.value = data?.rows ?? 0
})

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    toast.success('Copied.')
  } catch {
    toast.error('Copy failed. Select the text and copy it instead.')
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([text.value], { type: 'text/plain' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `${props.filename}.txt` })
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<!-- Plain-text export (AC-51, AC-52). -->
<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Export</DialogTitle>
        <DialogDescription>{{ rows }} {{ rows === 1 ? 'row' : 'rows' }}</DialogDescription>
      </DialogHeader>
      <Textarea :model-value="text" readonly rows="12" class="font-mono text-xs" aria-label="Exported list" data-testid="export-text" />
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="download"><DownloadIcon /> Download .txt</Button>
        <Button @click="copy"><CopyIcon /> Copy</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
