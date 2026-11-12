<script setup lang="ts">
import { ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { CheckIcon, ListPlusIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/composables/useConfirm'
import type { Opponent } from '@/lib/sims'
import SeatTile from './SeatTile.vue'

/**
 * Opponent pool, my decks and public decks; the pool can be added to, renamed and pruned
 * (spec 024, AC-4, AC-8 to AC-10). Any deck in the lists can be copied to the pool (spec 025, AC-4).
 */
const props = defineProps<{ title: string; start?: 'pool' | 'mine' | 'public' }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ choose: [pick: Opponent] }>()
const confirm = useConfirm()

type Group = 'pool' | 'mine' | 'public'
const GROUPS: { value: Group; label: string }[] = [
  { value: 'pool', label: 'Opponent pool' }, { value: 'mine', label: 'My decks' }, { value: 'public', label: 'Public decks' },
]
const group = ref<Group>('pool')
const query = ref('')
const found = ref<Schemas['Opponents'] | null>(null)

async function load() {
  const { data } = await api.GET('/api/sims/opponents/', { params: { query: { q: query.value.trim() || undefined } } })
  found.value = data ?? { pool: [], mine: [], public: [] }
}
// Each opening starts fresh, on the group the seat calls for.
watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  group.value = props.start ?? 'pool'
  load()
})
watchDebounced(query, () => open.value && load(), { debounce: 250 })

// Add to pool: a deck from the lists, or a pasted list with a name.
const adding = ref<null | 'list'>(null)
const listName = ref('')
const listText = ref('')
const busy = ref(false)
async function addPool(body: Schemas['PoolDeckWrite']) {
  busy.value = true
  const { data, error } = await api.POST('/api/sims/pool/', { body })
  busy.value = false
  if (!data) return toast.error(Object.values(fieldErrors(error as unknown)).join(' ') || 'Could not add the deck.')
  toast.success('Added to the opponent pool.')
  adding.value = null
  listName.value = listText.value = ''
  group.value = 'pool'
  await load()
}

// Anyone can rename or remove any pool deck (AC-9).
const renaming = ref<number | null>(null)
const newName = ref('')
async function rename(pick: Opponent) {
  if (!newName.value.trim()) return
  const { error } = await api.PATCH('/api/sims/pool/{id}/', { params: { path: { id: pick.id } }, body: { name: newName.value.trim() } })
  if (error) return toast.error('Could not rename the deck.')
  renaming.value = null
  await load()
}
async function remove(pick: Opponent) {
  if (!(await confirm({ title: `Remove ${pick.name} from the opponent pool?`, description: 'Runs that used it keep their copy.', action: 'Remove' }))) return
  const { error } = await api.DELETE('/api/sims/pool/{id}/', { params: { path: { id: pick.id } } })
  if (error) return toast.error('Could not remove the deck.')
  toast.success(`Removed ${pick.name}.`)
  await load()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] w-full overflow-y-auto sm:max-w-2xl" data-testid="opponent-picker">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="sr-only">Pick a deck from the opponent pool, your decks or public decks</DialogDescription>
      </DialogHeader>
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="query" type="search" placeholder="Deck or commander" aria-label="Search opponents" class="min-w-48 flex-1" />
        <Button variant="outline" @click="adding = adding ? null : 'list'"><PlusIcon /> Paste a list</Button>
      </div>
      <form v-if="adding" class="grid gap-2 rounded-md border p-3" data-testid="pool-add-list" @submit.prevent="addPool({ name: listName, text: listText })">
        <Input v-model="listName" placeholder="Name" aria-label="Pool deck name" />
        <Textarea v-model="listText" rows="6" placeholder="Commander&#10;1 Krenko, Mob Boss&#10;&#10;Deck&#10;1 Sol Ring" aria-label="Decklist" />
        <Button type="submit" class="justify-self-end" :disabled="busy || !listName.trim() || !listText.trim()">Add to pool</Button>
      </form>
      <Tabs v-model="group">
        <TabsList>
          <TabsTrigger v-for="g in GROUPS" :key="g.value" :value="g.value">{{ g.label }}</TabsTrigger>
        </TabsList>
        <TabsContent v-for="g in GROUPS" :key="g.value" :value="g.value">
          <ul class="grid gap-1" :data-testid="`opponents-${g.value}`">
            <li v-for="pick in found?.[g.value] ?? []" :key="`${pick.source}-${pick.id}`" class="flex items-center gap-2" data-testid="opponent">
              <form v-if="renaming === pick.id && g.value === 'pool'" class="flex flex-1 items-center gap-2" @submit.prevent="rename(pick)">
                <Input v-model="newName" aria-label="New name" class="flex-1" />
                <IconButton label="Save name" type="submit" variant="ghost"><CheckIcon /></IconButton>
                <IconButton label="Cancel" variant="ghost" @click="renaming = null"><XIcon /></IconButton>
              </form>
              <template v-else>
                <SeatTile :pick="pick" button :label="pick.name" class="flex-1 p-1" @click="emit('choose', pick)" />
                <IconButton v-if="g.value !== 'pool'" label="Add to pool" variant="ghost" :disabled="busy" @click="addPool({ deck: pick.id })"><ListPlusIcon /></IconButton>
                <template v-if="g.value === 'pool'">
                  <IconButton label="Rename" variant="ghost" @click="renaming = pick.id; newName = pick.name"><PencilIcon /></IconButton>
                  <IconButton label="Remove from pool" variant="ghost" class="text-destructive" @click="remove(pick)"><Trash2Icon /></IconButton>
                </template>
              </template>
            </li>
            <li v-if="found && !found[g.value].length" class="p-2 text-sm text-muted-foreground">No decks found.</li>
          </ul>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
