<script setup lang="ts">
import { CircleAlertIcon, LoaderCircleIcon } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import InfoTip from '@/components/InfoTip.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Staff: where the scanner's recognition model comes from (spec 020). */
type Source = Schemas['ScannerSource']
type Kind = NonNullable<Source['kind']>

const DEFAULT_REPO = 'cfbender/manavault'
const POLL_MS = 2000

const source = ref<Source | null>(null)
const kind = ref<Kind>('github')
const repo = ref(DEFAULT_REPO)
const path = ref('')
const errors = ref<Record<string, string>>({})
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let announce = false

function show(data: Source) {
  const wasSyncing = source.value?.syncing
  source.value = data
  clearTimeout(timer)
  if (data.syncing) timer = setTimeout(refresh, POLL_MS)
  else if (wasSyncing && announce) {
    announce = false
    if (!data.last_error && data.installed) toast.success(`Scanner model ${data.installed.version} installed.`)
  }
}

async function refresh() {
  const { data } = await api.GET('/api/scanner/source/')
  if (data) show(data)
}

onMounted(async () => {
  const { data } = await api.GET('/api/scanner/source/')
  if (!data) return
  kind.value = data.kind ?? 'github'
  repo.value = data.repo || DEFAULT_REPO
  path.value = data.path ?? ''
  show(data)
})
onBeforeUnmount(() => clearTimeout(timer))

async function save() {
  busy.value = true
  errors.value = {}
  const body = kind.value === 'github' ? { kind: kind.value, repo: repo.value, path: '' } : { kind: kind.value, repo: repo.value, path: path.value }
  const { data, error } = await api.PUT('/api/scanner/source/', { body })
  busy.value = false
  if (error) return (errors.value = fieldErrors(error))
  announce = true
  show(data)
}

async function syncNow() {
  busy.value = true
  const { data } = await api.POST('/api/scanner/source/sync/')
  busy.value = false
  if (!data) return toast.error('Could not start the sync.')
  announce = true
  show(data)
}

const date = (at: string | null | undefined) =>
  at ? new Date(at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
</script>

<template>
  <Card data-testid="scanner-source">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        Scanner model
        <InfoTip text="Where the card recognition model is installed from: ManaVault's releases on GitHub, or a folder of bundles trained in Oracle on this server. Only staff see this." />
      </CardTitle>
    </CardHeader>
    <CardContent v-if="source" class="grid gap-4">
      <div class="grid gap-1">
        <Label>Installed</Label>
        <p data-testid="scanner-source-installed">
          <template v-if="source.installed">{{ source.installed.version }} · {{ date(source.installed.created) }}</template>
          <span v-else class="text-muted-foreground">None</span>
        </p>
      </div>

      <div class="grid gap-2">
        <Label for="scanner-source-kind">Source</Label>
        <Select v-model="kind">
          <SelectTrigger id="scanner-source-kind" class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="github">GitHub releases</SelectItem>
            <SelectItem value="folder">Server folder</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="kind === 'github'" class="grid gap-2">
        <Label for="scanner-source-repo">Repository</Label>
        <Input id="scanner-source-repo" v-model="repo" placeholder="cfbender/manavault" :aria-invalid="!!errors.repo" />
        <p v-if="errors.repo" class="text-sm text-destructive">{{ errors.repo }}</p>
      </div>
      <div v-else class="grid gap-2">
        <Label for="scanner-source-path">Path</Label>
        <Input id="scanner-source-path" v-model="path" placeholder="/srv/mtgvault-bundles" :aria-invalid="!!errors.path" />
        <p v-if="errors.path" class="text-sm text-destructive">{{ errors.path }}</p>
      </div>

      <p v-if="source.syncing" class="flex items-center gap-2 text-sm text-muted-foreground" data-testid="scanner-source-syncing">
        <LoaderCircleIcon class="size-4 animate-spin" /> Installing…
      </p>
      <Alert v-else-if="source.last_error" variant="destructive" class="bg-destructive/10" data-testid="scanner-source-error">
        <CircleAlertIcon />
        <AlertDescription>{{ source.last_error }}</AlertDescription>
      </Alert>
      <p v-else-if="source.last_sync_at" class="text-sm text-muted-foreground" data-testid="scanner-source-synced">
        Last sync {{ date(source.last_sync_at) }}
      </p>

      <div class="flex gap-2">
        <Button :disabled="busy || source.syncing" @click="save">Save</Button>
        <Button variant="outline" :disabled="busy || source.syncing" @click="syncNow">Sync now</Button>
      </div>
    </CardContent>
  </Card>
</template>
