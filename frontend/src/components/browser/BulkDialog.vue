<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Selection } from '@/composables/useSelection'
import { CONDITIONS, FINISHES, LANGUAGES } from '@/lib/cards'
import { useLocationsStore } from '@/stores/locations'

export type BulkAction = 'move' | 'edit' | 'delete'

const props = defineProps<{ action: BulkAction | null; selection: () => Selection }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()
const locations = useLocationsStore()

const target = ref('unfiled')
const changes = ref<{ condition?: string; language?: string; finish?: string }>({})
const counts = ref<Schemas['BulkResult'] | null>(null)
const busy = ref(false)

const title = computed(() => ({ move: 'Move cards', edit: 'Edit cards', delete: 'Delete cards' })[props.action ?? 'move'])
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function request(dryRun: boolean): Schemas['BulkRequest'] {
  return {
    action: props.action!,
    selection: props.selection() as Schemas['Selection'],
    ...(props.action === 'move' ? { location: target.value === 'unfiled' ? null : Number(target.value) } : {}),
    ...(props.action === 'edit' ? { changes: changes.value as Schemas['BulkChanges'] } : {}),
    dry_run: dryRun,
  }
}

// Counts for the confirm step (AC-41); edits recount when the finish changes (AC-42).
async function count() {
  if (!props.action) return
  const { data } = await api.POST('/api/items/bulk/', { body: request(true) })
  counts.value = data ?? null
}

watch(open, (isOpen) => {
  if (!isOpen) return
  target.value = 'unfiled'
  changes.value = {}
  counts.value = null
  if (!locations.loaded) locations.load()
  count()
})
watch(() => changes.value.finish, count)

async function confirm() {
  if (props.action === 'edit' && !Object.keys(changes.value).length) return toast.error('Choose what to change.')
  busy.value = true
  const { data, error } = await api.POST('/api/items/bulk/', { body: request(false) })
  busy.value = false
  if (error || !data) return toast.error('Something went wrong. Nothing changed.')
  const verb = { move: 'Moved', edit: 'Updated', delete: 'Deleted' }[props.action!]
  toast.success(`${verb} ${plural(data.cards, 'card')}.`)
  open.value = false
  emit('done')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md" data-testid="bulk-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription data-testid="bulk-counts">
          <template v-if="counts">
            {{ plural(counts.rows, 'row') }}, {{ plural(counts.cards, 'card') }}.
            <template v-if="counts.skipped"> {{ plural(counts.skipped, 'row') }} will be skipped: no such finish.</template>
          </template>
          <template v-else>Counting…</template>
        </DialogDescription>
      </DialogHeader>

      <div v-if="action === 'move'" class="grid gap-2">
        <Label for="bulk-target">Move to</Label>
        <Select v-model="target">
          <SelectTrigger id="bulk-target" class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unfiled">Unfiled</SelectItem>
            <SelectItem v-for="l in locations.locations" :key="l.id" :value="String(l.id)">{{ l.name }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="action === 'edit'" class="grid gap-4">
        <div v-for="field in [
          { key: 'condition', label: 'Condition', options: CONDITIONS },
          { key: 'language', label: 'Language', options: LANGUAGES },
          { key: 'finish', label: 'Finish', options: FINISHES },
        ] as const" :key="field.key" class="grid gap-2">
          <Label :for="`bulk-${field.key}`">{{ field.label }}</Label>
          <Select v-model="changes[field.key]">
            <SelectTrigger :id="`bulk-${field.key}`" class="w-full"><SelectValue placeholder="Keep as is" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button :variant="action === 'delete' ? 'destructive' : 'default'" :disabled="busy || !counts" @click="confirm">
          {{ { move: 'Move', edit: 'Apply', delete: 'Delete' }[action ?? 'move'] }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
