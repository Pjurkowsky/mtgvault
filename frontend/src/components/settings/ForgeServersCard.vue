<script setup lang="ts">
import { CircleAlertIcon, CircleCheckIcon } from '@lucide/vue'
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import InfoTip from '@/components/InfoTip.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Staff: Main and Fallback Forge, e.g. a faster PC and this server (spec 029, AC-7, AC-8). */
type Role = 'main' | 'fallback'
type Server = Schemas['ForgeServer']
type Result = Schemas['ForgeTestResult']

const ROLES: { role: Role; label: string; hint: string }[] = [
  { role: 'main', label: 'Main', hint: 'New games go here while it answers, e.g. a faster PC on your network' },
  { role: 'fallback', label: 'Fallback', hint: "Used while Main doesn't answer, e.g. the Forge on this server" },
]

const EXAMPLE = 'http://192.168.1.20:8790'
const servers = reactive<Record<Role, Server>>({ main: { url: '', key: '', slots: 1 }, fallback: { url: '', key: '', slots: 1 } })
const loaded = ref(false)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const results = reactive<Record<Role, Result | null>>({ main: null, fallback: null })
const testing = reactive<Record<Role, boolean>>({ main: false, fallback: false })

onMounted(async () => {
  const { data } = await api.GET('/api/sims/forge/')
  if (!data) return
  Object.assign(servers.main, data.main)
  Object.assign(servers.fallback, data.fallback)
  loaded.value = true
})

async function save() {
  busy.value = true
  errors.value = {}
  const { data, error } = await api.PUT('/api/sims/forge/', { body: { main: servers.main, fallback: servers.fallback } })
  busy.value = false
  if (error) {
    // Nested errors: {main: {url: [...]}} → "main.url".
    const e = error as Record<string, Record<string, unknown>>
    errors.value = Object.fromEntries(ROLES.flatMap(({ role }) => Object.entries(fieldErrors(e[role])).map(([k, v]) => [`${role}.${k}`, v])))
    return toast.error('Could not save the Forge settings.')
  }
  Object.assign(servers.main, data.main)
  Object.assign(servers.fallback, data.fallback)
  toast.success('Forge settings saved.')
}

const answered = (role: Role) => (results[role]?.ok ? results[role].version || '?' : '')
const failed = (role: Role) => (results[role] && !results[role].ok ? results[role].error || 'No answer.' : '')

async function test(role: Role) {
  testing[role] = true
  results[role] = null
  const { data } = await api.POST('/api/sims/forge/test/', { body: { url: servers[role].url, key: servers[role].key } })
  testing[role] = false
  results[role] = data ?? { ok: false, version: '', error: 'Could not test this Forge.' }
}
</script>

<template>
  <Card data-testid="forge-servers">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        Forge
        <InfoTip text="Where simulations are played. Each new game goes to Main while it answers, otherwise to Fallback. Only staff see this." />
      </CardTitle>
    </CardHeader>
    <CardContent v-if="loaded" class="grid gap-6">
      <section v-for="row in ROLES" :key="row.role" class="grid gap-3" :data-testid="`forge-${row.role}`">
        <h3 class="flex items-center gap-1 text-sm font-medium">{{ row.label }} <InfoTip :text="row.hint" /></h3>
        <div class="grid gap-3 sm:grid-cols-[1fr_12rem_8rem]">
          <div class="grid gap-1.5">
            <Label :for="`forge-${row.role}-url`">Address</Label>
            <Input :id="`forge-${row.role}-url`" v-model="servers[row.role].url" :placeholder="EXAMPLE" :aria-invalid="!!errors[`${row.role}.url`]" />
            <p v-if="errors[`${row.role}.url`]" class="text-sm text-destructive">{{ errors[`${row.role}.url`] }}</p>
          </div>
          <div class="grid gap-1.5">
            <Label :for="`forge-${row.role}-key`" class="flex items-center gap-1">Key <InfoTip text="The FORGE_KEY the Forge container was started with; empty when it has none" /></Label>
            <Input :id="`forge-${row.role}-key`" v-model="servers[row.role].key" type="password" autocomplete="off" />
          </div>
          <div class="grid gap-1.5">
            <Label :for="`forge-${row.role}-slots`" class="flex items-center gap-1">Games at once <InfoTip text="1 to 8. Each game uses about 1 GB of memory and a CPU core" /></Label>
            <Input :id="`forge-${row.role}-slots`" v-model.number="servers[row.role].slots" type="number" min="1" max="8" step="1" :aria-invalid="!!errors[`${row.role}.slots`]" />
            <p v-if="errors[`${row.role}.slots`]" class="text-sm text-destructive">{{ errors[`${row.role}.slots`] }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" :disabled="!servers[row.role].url.trim() || testing[row.role]" @click="test(row.role)">Test</Button>
          <p v-if="answered(row.role)" class="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400" data-testid="forge-test-ok">
            <CircleCheckIcon class="size-4" /> Forge {{ answered(row.role) }}
          </p>
        </div>
        <Alert v-if="failed(row.role)" variant="destructive" class="bg-destructive/10" data-testid="forge-test-error">
          <CircleAlertIcon />
          <AlertDescription>{{ failed(row.role) }}</AlertDescription>
        </Alert>
      </section>
      <Button class="justify-self-start" :disabled="busy" @click="save">Save</Button>
    </CardContent>
  </Card>
</template>
