<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CopyIcon, DownloadIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { usePreference } from '@/composables/usePreference'

/** A checkbox the export passes to `load`, ticked unless remembered off (spec 014, AC-3 to AC-6). */
export type ExportOption = 'printings' | 'categories' | 'other_decks' | 'tokens'
export type ExportOptions = Partial<Record<ExportOption, boolean>>

const LABELS: Record<ExportOption, string> = {
  printings: 'Printings', categories: 'Categories', other_decks: 'Include cards in other decks', tokens: 'Tokens',
}
// Tokens start off (spec 015, AC-8); the rest start on.
const OFF_BY_DEFAULT: ExportOption[] = ['tokens']

const props = withDefaults(defineProps<{
  load: (options: ExportOptions) => Promise<{ text: string; rows: number } | undefined>
  filename: string
  /** Printings always shows; decks add more. */
  options?: ExportOption[]
}>(), { options: () => ['printings'] })
const open = defineModel<boolean>('open', { required: true })

const text = ref('')
const rows = ref(0)
// Remembered in this browser, shared by every export (AC-6).
const prefs = Object.fromEntries((Object.keys(LABELS) as ExportOption[])
  .map((key) => [key, usePreference<'on' | 'off'>(`export.${key}`, OFF_BY_DEFAULT.includes(key) ? 'off' : 'on', ['on', 'off'])])) as Record<ExportOption, ReturnType<typeof usePreference<'on' | 'off'>>>
const chosen = computed<ExportOptions>(() => Object.fromEntries(props.options.map((key) => [key, prefs[key].value === 'on'])))

let request = 0
async function reload() {
  const mine = ++request
  const data = await props.load(chosen.value)
  if (mine !== request) return // a newer choice is loading
  text.value = data?.text ?? ''
  rows.value = data?.rows ?? 0
}
watch(open, (isOpen) => {
  if (!isOpen) return
  text.value = ''
  void reload()
})
watch(chosen, () => open.value && void reload())

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

<!-- Plain-text export (spec 001 AC-51, AC-52; spec 014). -->
<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-full sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Export</DialogTitle>
        <DialogDescription>{{ rows }} {{ rows === 1 ? 'row' : 'rows' }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-wrap gap-x-5 gap-y-2" data-testid="export-options">
        <label v-for="key in options" :key="key" class="flex items-center gap-2 text-sm">
          <Checkbox
            :model-value="prefs[key].value === 'on'" :aria-label="LABELS[key]"
            @update:model-value="(v) => (prefs[key].value = v ? 'on' : 'off')"
          />
          {{ LABELS[key] }}
        </label>
      </div>
      <!-- A fixed box: long lines scroll sideways and the dialog keeps its size (AC-2). -->
      <Textarea
        :model-value="text" readonly wrap="off" aria-label="Exported list" data-testid="export-text"
        class="field-sizing-fixed h-64 w-full resize-none overflow-auto font-mono text-xs whitespace-pre"
      />
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="download"><DownloadIcon /> Download .txt</Button>
        <Button @click="copy"><CopyIcon /> Copy</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
