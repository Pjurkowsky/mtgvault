<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PlusIcon, Trash2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import ManaSymbol from '@/components/ManaSymbol.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/composables/useConfirm'
import type { Binder } from '@/lib/binder'
import GridPicker from './GridPicker.vue'
import SectionFilter from './SectionFilter.vue'

/** Pockets per page, facing pages, page count and sections (spec 007, AC-6 to AC-10). */
const props = defineProps<{ locationId: number; binder: Binder }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [binder: Binder] }>()
const confirm = useConfirm()

type Section = { name: string; first_page: number; last_page: number; filter: Record<string, unknown> }
const grid = ref({ rows: 3, cols: 3 })
const spread = ref(true)
const fixed = ref(false)
const pages = ref(20)
const sections = ref<Section[]>([])
const error = ref('')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  const b = props.binder
  grid.value = { rows: b.rows, cols: b.cols }
  spread.value = b.spread
  fixed.value = b.pages != null
  pages.value = b.pages ?? Math.max(b.page_count, 1)
  sections.value = b.sections.map((s) => ({ name: s.name, first_page: s.first_page, last_page: s.last_page, filter: { ...(s.filter ?? {}) } }))
  error.value = ''
})

type Color = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
const colorsOf = (f: Record<string, unknown>) => (Array.isArray(f.color) ? (f.color as Color[]) : [])
function updateFilter(section: Section, patch: Record<string, unknown>) {
  const next = { ...section.filter, ...patch }
  for (const [k, v] of Object.entries(next)) if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete next[k]
  section.filter = next
}
function addSection() {
  const last = Math.max(0, ...sections.value.map((s) => s.last_page))
  sections.value.push({ name: '', first_page: last + 1, last_page: last + 1, filter: {} })
}

/** Cards that would lose their slot with the new grid or page count (AC-8). */
const losing = computed(() =>
  props.binder.slots.filter((s) => s.row > grid.value.rows || s.col > grid.value.cols || (fixed.value && s.page > pages.value)).length,
)

/** Section errors come nested per row: show the first message. */
function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  for (const v of Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []) {
    const found = firstMessage(v)
    if (found) return found
  }
  return null
}

async function save() {
  if (losing.value) {
    const ok = await confirm({
      title: `${losing.value} ${losing.value === 1 ? 'card loses its' : 'cards lose their'} slot`,
      description: 'They no longer fit and move to Unplaced. The other cards keep their page, row and column.',
      action: 'Save',
    })
    if (!ok) return
  }
  saving.value = true
  error.value = ''
  const { data, error: err } = await api.PATCH('/api/locations/{id}/binder/', {
    params: { path: { id: props.locationId } },
    body: {
      rows: grid.value.rows, cols: grid.value.cols, spread: spread.value, pages: fixed.value ? pages.value : null,
      sections: sections.value.map((s) => ({ ...s, name: s.name.trim() })) as never,
    },
  })
  saving.value = false
  if (!data) return (error.value = firstMessage(err) ?? 'Could not save.')
  toast.success(data.unplaced_now ? `Saved. ${data.unplaced_now} moved to Unplaced.` : 'Saved.')
  emit('saved', data)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="binder-settings">
      <DialogHeader><DialogTitle>Binder settings</DialogTitle></DialogHeader>
      <Alert v-if="error" variant="destructive" class="bg-destructive/10"><AlertDescription>{{ error }}</AlertDescription></Alert>

      <GridPicker v-model="grid" />
      <Separator />
      <label class="flex items-center justify-between gap-4 text-sm">
        Facing pages
        <Switch v-model="spread" aria-label="Facing pages" />
      </label>
      <div class="flex items-center justify-between gap-4 text-sm">
        <label for="fixed-pages" class="flex-1">Fixed page count</label>
        <Input v-if="fixed" v-model.number="pages" type="number" min="1" max="500" class="w-24" aria-label="Pages" />
        <Switch id="fixed-pages" v-model="fixed" aria-label="Fixed page count" />
      </div>
      <Separator />

      <section class="grid gap-3" data-testid="sections">
        <div class="flex items-center justify-between">
          <Label>Sections</Label>
          <Button size="sm" variant="outline" type="button" @click="addSection"><PlusIcon /> Add section</Button>
        </div>
        <div v-for="(s, i) in sections" :key="i" class="grid gap-2" data-testid="section-row">
          <div class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2">
            <Input v-model="s.name" placeholder="Name" aria-label="Section name" maxlength="60" />
            <span class="flex gap-0.5" data-testid="section-colors">
              <ManaSymbol v-for="c in colorsOf(s.filter)" :key="c" :symbol="c" class="size-4" />
            </span>
            <Input v-model.number="s.first_page" type="number" min="1" max="500" class="w-16" aria-label="First page" />
            <Input v-model.number="s.last_page" type="number" min="1" max="500" class="w-16" aria-label="Last page" />
            <IconButton :label="`Remove ${s.name || 'section'}`" variant="ghost" class="text-destructive" @click="sections.splice(i, 1)"><Trash2Icon /></IconButton>
          </div>
          <SectionFilter :filter="s.filter" @update="(patch) => updateFilter(s, patch)" />
        </div>
      </section>

      <DialogFooter><Button :disabled="saving" @click="save">Save</Button></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
