<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { XIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { useCamera } from '@/scanner/camera'

/** Scanner settings, saved to the account (spec 003, AC-12, AC-15, AC-16; spec 019, AC-1, AC-4). */
const props = defineProps<{
  settings: Schemas['ScannerSettings']
  currency: string
  ready: { version: string; threads: number } | null
  save: (patch: Partial<Schemas['ScannerSettings']>) => Promise<boolean>
  /** Camera controls, saved on this device (spec 019, AC-9, AC-10). */
  camera?: ReturnType<typeof useCamera>
}>()
const open = defineModel<boolean>('open', { required: true })

const low = ref(String(props.settings.ding_low))
const high = ref(String(props.settings.ding_high))
// Refresh the fields from saved settings, but never while the user is typing in them
// (another setting's save would otherwise overwrite what they typed).
const editing = ref(false)
watch(() => props.settings, (s) => {
  if (editing.value) return
  low.value = String(s.ding_low)
  high.value = String(s.ding_high)
})
const error = ref('')
async function saveThresholds() {
  error.value = ''
  const ok = await props.save({ ding_low: Number(low.value), ding_high: Number(high.value) })
  if (!ok) error.value = 'The high threshold must be at least the low one.'
}

// Glare sensitivity: saved when the thumb is let go (spec 019, AC-4).
const sensitivity = ref([props.settings.glare_sensitivity ?? 50])
watch(() => props.settings.glare_sensitivity, (v) => (sensitivity.value = [v ?? 50]))

// Camera: only what this camera supports (spec 019, AC-9).
const controls = computed(() => props.camera?.controls.value ?? { autoFocus: false })
const values = computed(() => props.camera?.values.value ?? {})
const hasCamera = computed(() => !!(controls.value.exposure || controls.value.zoom || controls.value.focus))
const middle = (r: { min: number; max: number }) => (r.min + r.max) / 2
const manualFocus = computed(() => typeof values.value.focus === 'number')

// Locked sets: search, tick to lock (AC-8).
const query = ref('')
const results = ref<Schemas['Set'][]>([])
let timer: ReturnType<typeof setTimeout>
watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) return (results.value = [])
  timer = setTimeout(async () => {
    const { data } = await api.GET('/api/catalog/sets/', { params: { query: { q } } })
    results.value = data ?? []
  }, 200)
})
const lockedSet = computed(() => new Set(props.settings.locked_sets ?? []))
function toggleSet(code: string, on: boolean) {
  const next = new Set(props.settings.locked_sets ?? [])
  if (on) next.add(code)
  else next.delete(code)
  void props.save({ locked_sets: [...next] })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="overflow-y-auto" data-testid="scanner-settings">
      <SheetHeader><SheetTitle>Scanner settings</SheetTitle></SheetHeader>
      <div class="grid gap-5 px-4 pb-6">
        <div class="flex items-center gap-3">
          <Switch id="scan-sounds" :model-value="settings.sounds" @update:model-value="(v) => save({ sounds: v })" />
          <Label for="scan-sounds" class="font-normal">Sounds</Label>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-1.5">
            <Label for="ding-low">Ding from ({{ currency }})</Label>
            <Input id="ding-low" v-model="low" type="number" min="0" step="0.01" @focus="editing = true" @blur="editing = false" @change="saveThresholds" />
          </div>
          <div class="grid gap-1.5">
            <Label for="ding-high">Big ding from ({{ currency }})</Label>
            <Input id="ding-high" v-model="high" type="number" min="0" step="0.01" @focus="editing = true" @blur="editing = false" @change="saveThresholds" />
          </div>
          <p v-if="error" class="col-span-2 text-sm text-destructive">{{ error }}</p>
        </div>
        <div class="flex items-center gap-3">
          <Switch id="scan-total" :model-value="settings.show_total" @update:model-value="(v) => save({ show_total: v })" />
          <Label for="scan-total" class="font-normal">Running total</Label>
        </div>
        <Separator />
        <!-- Help through binder glare (spec 019, AC-1 to AC-8) -->
        <div class="grid gap-3">
          <div class="flex items-center gap-3">
            <Switch id="glare-hint" :model-value="settings.glare_hint" @update:model-value="(v) => save({ glare_hint: v })" />
            <Label for="glare-hint" class="font-normal">Glare hint</Label>
          </div>
          <div v-if="settings.glare_hint" class="grid gap-2 pl-11" data-testid="glare-sensitivity">
            <span class="text-sm">Glare sensitivity</span>
            <div class="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Low</span>
              <Slider v-model="sensitivity" label="Glare sensitivity" :min="0" :max="100" :step="5" @value-commit="(v) => save({ glare_sensitivity: v[0] })" />
              <span>High</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Switch id="combine-frames" :model-value="settings.combine_frames" @update:model-value="(v) => save({ combine_frames: v })" />
            <Label for="combine-frames" class="font-normal">Combine frames</Label>
          </div>
          <div class="flex items-center gap-3">
            <Switch id="suggest-guesses" :model-value="settings.suggest_guesses" @update:model-value="(v) => save({ suggest_guesses: v })" />
            <Label for="suggest-guesses" class="font-normal">Suggest guesses</Label>
          </div>
        </div>
        <template v-if="camera && hasCamera">
          <Separator />
          <section class="grid gap-3" data-testid="camera-controls">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Camera</span>
              <Button size="sm" variant="outline" @click="camera.resetControls()">Reset</Button>
            </div>
            <div v-if="controls.exposure" class="grid gap-2">
              <span class="text-sm">Exposure</span>
              <Slider
                label="Exposure" :min="controls.exposure.min" :max="controls.exposure.max" :step="controls.exposure.step"
                :model-value="[values.exposure ?? 0]" @update:model-value="(v) => v && camera!.setControl({ exposure: v[0] })"
              />
            </div>
            <div v-if="controls.zoom" class="grid gap-2">
              <span class="text-sm">Zoom</span>
              <Slider
                label="Zoom" :min="controls.zoom.min" :max="controls.zoom.max" :step="controls.zoom.step"
                :model-value="[values.zoom ?? controls.zoom.min]" @update:model-value="(v) => v && camera!.setControl({ zoom: v[0] })"
              />
            </div>
            <div v-if="controls.focus" class="grid gap-2">
              <div class="flex items-center gap-3">
                <Switch
                  id="auto-focus" :model-value="!manualFocus"
                  @update:model-value="(auto) => camera!.setControl({ focus: auto ? 'auto' : middle(controls.focus!) })"
                />
                <Label for="auto-focus" class="font-normal">Auto focus</Label>
              </div>
              <Slider
                v-if="manualFocus" label="Focus distance" :min="controls.focus.min" :max="controls.focus.max" :step="controls.focus.step"
                :model-value="[values.focus as number]" @update:model-value="(v) => v && camera!.setControl({ focus: v[0] })"
              />
            </div>
          </section>
        </template>
        <Separator />
        <section class="grid gap-2">
          <Label for="locked-search">Locked sets</Label>
          <div v-if="settings.locked_sets?.length" class="flex flex-wrap gap-1.5" data-testid="locked-sets">
            <Badge v-for="code in settings.locked_sets" :key="code" variant="secondary" class="gap-1 pr-1 uppercase">
              {{ code }}
              <button type="button" class="rounded-sm p-0.5 hover:bg-muted-foreground/20" :aria-label="`Unlock ${code}`" @click="toggleSet(code, false)">
                <XIcon class="size-3" />
              </button>
            </Badge>
          </div>
          <Input id="locked-search" v-model="query" placeholder="Search sets" autocomplete="off" />
          <label v-for="s in results" :key="s.code" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="lockedSet.has(s.code)" @update:model-value="(on) => toggleSet(s.code, on === true)" />
            <span class="truncate">{{ s.name }}</span>
            <span class="text-muted-foreground uppercase">{{ s.code }}</span>
          </label>
        </section>
        <Separator />
        <p class="text-sm text-muted-foreground" data-testid="threads-info">
          <template v-if="ready">Recognition uses {{ ready.threads }} {{ ready.threads === 1 ? 'thread' : 'threads' }} · model {{ ready.version }}</template>
          <template v-else>Recognition model loading…</template>
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>
