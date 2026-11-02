<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftIcon, BoxIcon, CircleAlertIcon, CircleCheckIcon, DownloadIcon, EllipsisIcon, GlobeIcon, LayoutGridIcon,
  ListIcon, PackagePlusIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon,
} from '@lucide/vue'
import { api } from '@/api/client'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import ExportDialog from '@/components/browser/ExportDialog.vue'
import CreateBoxDialog from '@/components/decks/CreateBoxDialog.vue'
import DeckAddDialog from '@/components/decks/DeckAddDialog.vue'
import DeckCardDialog from '@/components/decks/DeckCardDialog.vue'
import DeckImportDialog from '@/components/decks/DeckImportDialog.vue'
import DeckList from '@/components/decks/DeckList.vue'
import DeckStats from '@/components/decks/DeckStats.vue'
import DeckVisual from '@/components/decks/DeckVisual.vue'
import DeleteDeckDialog from '@/components/decks/DeleteDeckDialog.vue'
import EditDeckDialog from '@/components/decks/EditDeckDialog.vue'
import LegalityPanel from '@/components/decks/LegalityPanel.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatLabel, type DeckCard, type DeckDetail, type GroupBy, type SortBy } from '@/lib/decks'

/** A deck: list, owned and missing cards, stats; also the public view (spec 004, AC-16 to AC-28). */
const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const username = computed(() => (route.name === 'public-deck' ? String(route.params.username) : null))
const isOwner = computed(() => !username.value)

const deck = ref<DeckDetail | null>(null)
const notFound = ref(false)

async function load() {
  deck.value = null
  notFound.value = false
  const { data } = username.value
    ? await api.GET('/api/users/{username}/decks/{id}/', { params: { path: { username: username.value, id: id.value } } })
    : await api.GET('/api/decks/{id}/', { params: { path: { id: id.value } } })
  deck.value = data ?? null
  notFound.value = !data
}
watch([id, username], load, { immediate: true })

// Tab, layout, grouping and sort live in the URL so reloads keep them.
type Tab = 'deck' | 'owned' | 'missing' | 'stats'
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
const tab = computed<Tab>(() => (one(route.query.tab) as Tab) || 'deck')
const layout = computed(() => (one(route.query.layout) === 'visual' ? 'visual' : 'list'))
const groupBy = computed<GroupBy>(() => (one(route.query.group) as GroupBy) || 'type')
const sortBy = computed<SortBy>(() => (one(route.query.order) as SortBy) || 'name')
function setQuery(patch: Record<string, string | undefined>) {
  router.replace({ query: { ...route.query, ...patch } })
}
/** Tabs share the browser's URL filters; switching drops them. */
function setTab(next: Tab) {
  router.replace({ query: { ...(next !== 'deck' ? { tab: next } : {}), layout: route.query.layout, group: route.query.group, order: route.query.order } })
}

const cardOpen = ref(false)
const openCard = ref<DeckCard | null>(null)
function showCard(card: DeckCard) {
  openCard.value = card
  cardOpen.value = true
}
function changed(next: DeckDetail) {
  deck.value = next
  if (openCard.value) openCard.value = next.cards.find((c) => c.id === openCard.value!.id) ?? null
}

const addOpen = ref(false)
const importOpen = ref(false)
const exportOpen = ref(false)
const editOpen = ref(false)
const boxOpen = ref(false)
const deleteOpen = ref(false)

async function loadExport() {
  return (await api.GET('/api/decks/{id}/export/', { params: { path: { id: id.value } } })).data
}

const counts = computed(() => deck.value?.counts)
const sizeOff = computed(() => !!counts.value?.target && counts.value.size !== counts.value.target)
</script>

<template>
  <div v-if="notFound" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">Deck not found</h1>
  </div>
  <div v-else-if="deck" class="grid gap-6">
    <div class="grid gap-2">
      <RouterLink
        :to="isOwner ? { name: 'decks' } : { name: 'profile', params: { username: deck.username } }"
        class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon class="size-4" /> {{ isOwner ? 'Decks' : deck.username }}
      </RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-semibold" data-testid="deck-name">{{ deck.name }}</h1>
        <span class="text-sm text-muted-foreground" data-testid="deck-format">{{ formatLabel(deck.format) }}</span>
        <GlobeIcon v-if="deck.is_public && isOwner" class="size-4 text-muted-foreground" aria-label="Public" />
        <div v-if="isOwner" class="ml-auto flex gap-2">
          <Button @click="addOpen = true"><PlusIcon /> Add card</Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <IconButton label="More"><EllipsisIcon /></IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="importOpen = true"><UploadIcon /> Import</DropdownMenuItem>
              <DropdownMenuItem @select="exportOpen = true"><DownloadIcon /> Export</DropdownMenuItem>
              <DropdownMenuItem @select="editOpen = true"><PencilIcon /> Edit</DropdownMenuItem>
              <DropdownMenuItem v-if="!deck.location" @select="boxOpen = true"><PackagePlusIcon /> Create deck box</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @select="deleteOpen = true"><Trash2Icon /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground" data-testid="deck-header">
        <span data-testid="deck-size" :class="sizeOff && 'text-destructive'">{{ counts!.size }}{{ counts!.target ? ` / ${counts!.target}` : '' }} cards</span>
        <span>·</span>
        <Price :value="deck.value" :values="deck.values" :currency="deck.currency" />
        <template v-if="deck.format !== 'casual'">
          <span>·</span>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button" class="flex items-center gap-1" :class="deck.legality.legal ? 'text-emerald-600' : 'text-destructive'"
                data-testid="deck-legal" @click="setTab('stats')"
              >
                <CircleCheckIcon v-if="deck.legality.legal" class="size-4" /><CircleAlertIcon v-else class="size-4" />
                {{ deck.legality.legal ? 'Legal' : `${deck.legality.issues.length} ${deck.legality.issues.length === 1 ? 'issue' : 'issues'}` }}
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ deck.legality.legal ? `Legal in ${formatLabel(deck.format)}` : 'Show issues' }}</TooltipContent>
          </Tooltip>
        </template>
        <template v-if="deck.location && isOwner">
          <span>·</span>
          <RouterLink :to="{ name: 'location', params: { id: deck.location } }" class="flex items-center gap-1 hover:text-foreground" data-testid="deck-box">
            <BoxIcon class="size-4" /> {{ deck.location_name }}
          </RouterLink>
        </template>
      </p>
    </div>

    <Tabs :model-value="tab" @update:model-value="(v) => setTab(v as Tab)">
      <TabsList>
        <TabsTrigger value="deck">Deck</TabsTrigger>
        <TabsTrigger v-if="isOwner" value="owned">Owned <span class="text-muted-foreground">{{ counts!.owned }}</span></TabsTrigger>
        <TabsTrigger v-if="isOwner" value="missing">Missing <span class="text-muted-foreground">{{ counts!.missing }}</span></TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>

      <TabsContent value="deck" class="grid gap-4 pt-2">
        <div v-if="deck.cards.length" class="flex flex-wrap items-center gap-2">
          <Select :model-value="groupBy" @update:model-value="(v) => setQuery({ group: v === 'type' ? undefined : String(v) })">
            <SelectTrigger class="w-40" aria-label="Group by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="type">By type</SelectItem>
              <SelectItem value="mana_value">By mana value</SelectItem>
              <SelectItem value="color">By color</SelectItem>
            </SelectContent>
          </Select>
          <Select :model-value="sortBy" @update:model-value="(v) => setQuery({ order: v === 'name' ? undefined : String(v) })">
            <SelectTrigger class="w-36" aria-label="Sort by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="mana_value">Mana value</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup type="single" variant="outline" :model-value="layout" class="ml-auto" @update:model-value="(v) => v && setQuery({ layout: v === 'list' ? undefined : String(v) })">
            <Tooltip>
              <TooltipTrigger as-child><ToggleGroupItem value="list" aria-label="List"><ListIcon /></ToggleGroupItem></TooltipTrigger>
              <TooltipContent>List</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child><ToggleGroupItem value="visual" aria-label="Card images"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
              <TooltipContent>Card images</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>
        <DeckList v-if="deck.cards.length && layout === 'list'" :cards="deck.cards" :currency="deck.currency" :group-by="groupBy" :sort-by="sortBy" @open="showCard" />
        <DeckVisual v-else-if="deck.cards.length" :cards="deck.cards" :group-by="groupBy" :sort-by="sortBy" @open="showCard" />
        <p v-else class="py-16 text-center text-muted-foreground">No cards yet.</p>
      </TabsContent>

      <TabsContent v-if="isOwner" value="owned" class="pt-2">
        <CardBrowser v-if="tab === 'owned'" :source="{ kind: 'own' }" :deck="deck.id" @changed="load" />
      </TabsContent>
      <TabsContent v-if="isOwner" value="missing" class="pt-2">
        <CardBrowser v-if="tab === 'missing'" :source="{ kind: 'deck-missing', deckId: deck.id }" readonly />
      </TabsContent>

      <TabsContent value="stats" class="grid gap-4 pt-2">
        <LegalityPanel :deck="deck" />
        <DeckStats :deck="deck" />
      </TabsContent>
    </Tabs>

    <DeckCardDialog v-model:open="cardOpen" :deck="deck" :card="openCard" :readonly="!isOwner" @changed="changed" />
    <template v-if="isOwner">
      <DeckAddDialog v-model:open="addOpen" :deck="deck" @changed="changed" />
      <DeckImportDialog v-model:open="importOpen" :deck="deck" @changed="changed" />
      <ExportDialog v-model:open="exportOpen" :load="loadExport" :filename="deck.name" />
      <EditDeckDialog v-model:open="editOpen" :deck="deck" @changed="changed" />
      <CreateBoxDialog v-model:open="boxOpen" :deck="deck" @changed="changed" />
      <DeleteDeckDialog v-model:open="deleteOpen" :deck="deck" @deleted="router.push({ name: 'decks' })" />
    </template>
  </div>
  <div v-else class="grid gap-4">
    <Skeleton class="h-8 w-64" />
    <Skeleton class="h-96 w-full" />
  </div>
</template>
