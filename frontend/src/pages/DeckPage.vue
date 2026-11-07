<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftIcon, BadgePercentIcon, BoxIcon, CameraIcon, CircleAlertIcon, CircleCheckIcon, DownloadIcon, EllipsisIcon, GlobeIcon, HeartIcon,
  PackagePlusIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import ExportDialog, { type ExportOptions } from '@/components/browser/ExportDialog.vue'
import CategoryDialog from '@/components/decks/CategoryDialog.vue'
import CreateBoxDialog from '@/components/decks/CreateBoxDialog.vue'
import DeckAddDialog from '@/components/decks/DeckAddDialog.vue'
import DeckCardDetail from '@/components/decks/DeckCardDetail.vue'
import DeckImportDialog from '@/components/decks/DeckImportDialog.vue'
import DeckList from '@/components/decks/DeckList.vue'
import DeckSwaps from '@/components/decks/DeckSwaps.vue'
import DeckText from '@/components/decks/DeckText.vue'
import DeckToolbar, { type DeckOption, type Layout } from '@/components/decks/DeckToolbar.vue'
import DeckTokens from '@/components/decks/DeckTokens.vue'
import OptimizeDialog from '@/components/decks/OptimizeDialog.vue'
import ProposeSwapDialog from '@/components/decks/ProposeSwapDialog.vue'
import ScanTargetDialog from '@/components/decks/ScanTargetDialog.vue'
import DeckStats from '@/components/decks/DeckStats.vue'
import DeckVisual from '@/components/decks/DeckVisual.vue'
import DeleteDeckDialog from '@/components/decks/DeleteDeckDialog.vue'
import EditDeckDialog from '@/components/decks/EditDeckDialog.vue'
import LegalityPanel from '@/components/decks/LegalityPanel.vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirm } from '@/composables/useConfirm'
import { useCardNavigation } from '@/composables/useCardNavigation'
import { usePreference } from '@/composables/usePreference'
import { CARD_SIZES, type CardSize } from '@/lib/cards'
import { clearedQuery, filterFromQuery, filterToQuery, matches, type DeckFilter } from '@/lib/deckFilter'
import { loadScanTarget, saveScanTarget, scannerUrl, type ScanTarget } from '@/lib/scanTarget'
import { WANT_MISSING, ZONE_LABELS, formatLabel, type DeckCard, type DeckDetail, type GroupBy, type SortBy, type Zone } from '@/lib/decks'

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

// The tab lives in the URL. View, grouping and sort are remembered in the browser for
// all decks; options in the URL win (spec 005, AC-8).
type Tab = 'deck' | 'swaps' | 'stats'
const LAYOUTS = ['text', 'list', 'visual'] as const
const GROUPS = ['type', 'mana_value', 'color', 'category'] as const
const ORDERS = ['name', 'mana_value', 'price'] as const
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) => (allowed.includes(value as T) ? (value as T) : undefined)
const savedLayout = usePreference<Layout>('deck.layout', 'text', LAYOUTS)
const savedGroup = usePreference<GroupBy>('deck.group', 'type', GROUPS)
const savedOrder = usePreference<SortBy>('deck.order', 'name', ORDERS)
const size = usePreference<CardSize>('deck.size', 'md', CARD_SIZES)
const tab = computed<Tab>(() => pick(one(route.query.tab), ['swaps', 'stats'] as const) ?? 'deck')
const layout = computed<Layout>(() => pick(one(route.query.layout), LAYOUTS) ?? savedLayout.value)
const groupBy = computed<GroupBy>(() => pick(one(route.query.group), GROUPS) ?? savedGroup.value)
const sortBy = computed<SortBy>(() => pick(one(route.query.order), ORDERS) ?? savedOrder.value)
/** Remember the choice and drop it from the URL, so the remembered one applies. */
function setOption(key: DeckOption, value: string) {
  if (key === 'size') return void (size.value = value as CardSize)
  if (key === 'layout') savedLayout.value = value as Layout
  if (key === 'group') savedGroup.value = value as GroupBy
  if (key === 'order') savedOrder.value = value as SortBy
  router.replace({ query: { ...route.query, [key]: undefined } })
}
function setTab(next: Tab) {
  router.replace({ query: { ...route.query, tab: next !== 'deck' ? next : undefined } })
}

const deckTab = ref<InstanceType<typeof TabsContent> | null>(null)
const nav = useCardNavigation(computed(() => (deckTab.value?.$el as HTMLElement | undefined) ?? null))

// Search and filters live in the URL (spec 006, AC-5 to AC-7).
const filter = computed(() => filterFromQuery(route.query))
const shown = computed(() => deck.value?.cards.filter((c) => matches(c, filter.value)) ?? [])
const setFilter = (patch: Partial<DeckFilter>) => router.replace({ query: { ...route.query, ...filterToQuery(patch) } })
/** A chart click opens the Deck tab with only that filter (AC-17). */
const showFiltered = (patch: Partial<DeckFilter>) => router.replace({ query: { ...route.query, ...clearedQuery(), ...filterToQuery(patch), tab: undefined } })
const clearFilters = () => router.replace({ query: { ...route.query, ...clearedQuery(), q: route.query.q } })

const cardOpen = ref(false)
const openCard = ref<DeckCard | null>(null)
function showCard(card: DeckCard) {
  openCard.value = card
  cardOpen.value = true
}
const confirm = useConfirm()
const categoriesOpen = ref(false)
function editCategories(card: DeckCard) {
  openCard.value = card
  categoriesOpen.value = true
}
const swapOpen = ref(false)
const swapCard = ref<DeckCard | null>(null)
function proposeSwap(card: DeckCard) {
  swapCard.value = card
  swapOpen.value = true
}

/** Delete from the menu (AC-7) or Remove a candidate (AC-11): the card leaves the deck. */
async function removeCard(card: DeckCard) {
  const ok = await confirm({
    title: `Remove ${card.printing.name}?`, description: `From ${deck.value!.name} (${ZONE_LABELS[card.zone as Zone]}).`, action: 'Remove',
  })
  if (!ok) return
  const { data } = await api.DELETE('/api/decks/{id}/cards/{card_id}/', { params: { path: { id: id.value, card_id: card.id } } })
  if (!data) return toast.error('Could not remove the card.')
  toast.success(`Removed ${card.printing.name}.`)
  changed(data)
}

async function applySwap(candidate: DeckCard) {
  const { data } = await api.POST('/api/decks/{id}/cards/{card_id}/apply-swap/', { params: { path: { id: id.value, card_id: candidate.id } } })
  if (!data) return toast.error('Could not apply the swap.')
  toast.success(`Swapped in ${candidate.printing.name}.`)
  changed(data)
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
const scanOpen = ref(false)

/** Scan cards: ask where they go, remember it, open the scanner (AC-15, AC-16). */
async function scan(target: ScanTarget) {
  const id = deck.value!.id
  saveScanTarget(id, target)
  const { data } = await api.GET('/api/scanner/settings/')
  if (data?.fast) window.location.assign(scannerUrl(id, true))
  else router.push(scannerUrl(id, false))
}

async function loadExport(options: ExportOptions) {
  return (await api.GET('/api/decks/{id}/export/', { params: { path: { id: id.value }, query: options } })).data
}
// Missing cards as a list, as the Missing tab did (spec 004 AC-17, spec 006 AC-8).
const missingOpen = ref(false)
async function loadMissing(options: ExportOptions) {
  return (await api.POST('/api/decks/{id}/missing/export/', { params: { path: { id: id.value } }, body: options })).data
}

/** Missing cards onto the want list for this deck: one card, or all of them (spec 010, AC-15, AC-16). */
async function wantMissing(card?: DeckCard) {
  const { data } = await api.POST('/api/decks/{id}/want-missing/', { params: { path: { id: id.value } }, body: card ? { card: card.id } : {} })
  if (!data) return toast.error('Could not add to the want list.')
  changed(data.deck)
  if (!data.added) return toast.success(card ? `${card.printing.name} is already on the want list.` : 'Nothing is missing from the want list.')
  toast.success(`Added ${data.added} ${data.added === 1 ? 'card' : 'cards'} to the want list.`)
}
provide(WANT_MISSING, (card) => void wantMissing(card))

// Cheapest printings for the cards the deck lacks (spec 013).
const optimizeOpen = ref(false)
const optimizeChanges = ref<Schemas['OptimizeChange'][]>([])
async function optimize() {
  const { data } = await api.GET('/api/decks/{id}/optimize/', { params: { path: { id: id.value } } })
  if (!data) return toast.error('Could not look up printings.')
  if (!data.changes.length) return toast.success('Missing cards already use their cheapest printings.')
  optimizeChanges.value = data.changes
  optimizeOpen.value = true
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
          <Button variant="outline" @click="scanOpen = true"><CameraIcon /> Scan cards</Button>
          <Button @click="addOpen = true"><PlusIcon /> Add card</Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <IconButton label="More"><EllipsisIcon /></IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="importOpen = true"><UploadIcon /> Import</DropdownMenuItem>
              <DropdownMenuItem @select="exportOpen = true"><DownloadIcon /> Export</DropdownMenuItem>
              <DropdownMenuItem @select="missingOpen = true"><DownloadIcon /> Export missing</DropdownMenuItem>
              <DropdownMenuItem @select="wantMissing()"><HeartIcon /> Add missing to want list</DropdownMenuItem>
              <DropdownMenuItem @select="optimize()"><BadgePercentIcon /> Optimize printings</DropdownMenuItem>
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
        <template v-if="deck.location">
          <span>·</span>
          <RouterLink
            :to="isOwner ? { name: 'location', params: { id: deck.location } } : { name: 'public-location', params: { username: deck.username, id: deck.location } }" class="flex items-center gap-1 hover:text-foreground" data-testid="deck-box">
            <BoxIcon class="size-4" /> {{ deck.location_name }}
          </RouterLink>
        </template>
      </p>
    </div>

    <Tabs :model-value="tab" @update:model-value="(v) => setTab(v as Tab)">
      <TabsList>
        <TabsTrigger value="deck">Deck</TabsTrigger>
        <TabsTrigger value="swaps">Swaps</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>

      <TabsContent ref="deckTab" value="deck" class="grid gap-4 pt-2" @keydown="nav.onKeydown">
        <DeckToolbar
          v-if="deck.cards.length" :cards="deck.cards" :filter="filter" :group-by="groupBy" :sort-by="sortBy" :layout="layout" :size="size"
          @filter="setFilter" @clear="clearFilters" @option="setOption"
        />
        <DeckText
          v-if="shown.length && layout === 'text'" :cards="shown" :currency="deck.currency" :group-by="groupBy" :sort-by="sortBy" :editable="isOwner"
          @open="showCard" @categories="editCategories" @swap="proposeSwap" @delete="removeCard"
        />
        <DeckList
          v-else-if="shown.length && layout === 'list'" :cards="shown" :currency="deck.currency" :group-by="groupBy" :sort-by="sortBy"
          :editable="isOwner" @open="showCard" @categories="editCategories" @swap="proposeSwap" @delete="removeCard"
        />
        <DeckVisual
          v-else-if="shown.length" :cards="shown" :size="size" :currency="deck.currency" :group-by="groupBy" :sort-by="sortBy" :editable="isOwner"
          @open="showCard" @categories="editCategories" @swap="proposeSwap" @delete="removeCard"
        />
        <p v-else class="py-16 text-center text-muted-foreground">{{ deck.cards.length ? 'No cards match.' : 'No cards yet.' }}</p>
        <DeckTokens :tokens="deck.tokens" :cards="shown" />
      </TabsContent>

      <TabsContent value="swaps" class="pt-2">
        <DeckSwaps :deck="deck" :readonly="!isOwner" @open="showCard" @apply="applySwap" @remove="removeCard" />
      </TabsContent>

      <TabsContent value="stats" class="grid gap-4 pt-2">
        <LegalityPanel :deck="deck" />
        <DeckStats :deck="deck" @filter="showFiltered" @open="showCard" />
      </TabsContent>
    </Tabs>

    <CategoryDialog v-if="isOwner" v-model:open="categoriesOpen" :deck="deck" :card="openCard" @changed="changed" />
    <DeckCardDetail v-model:open="cardOpen" :deck="deck" :card="openCard" :readonly="!isOwner" @changed="changed" />
    <template v-if="isOwner">
      <DeckAddDialog v-model:open="addOpen" :deck="deck" @changed="changed" />
      <ScanTargetDialog
        v-model:open="scanOpen" :deck-id="deck.id" :box-id="deck.location" :current="loadScanTarget(deck.id)"
        @confirm="scan"
      />
      <ProposeSwapDialog v-model:open="swapOpen" :deck="deck" :card="swapCard" @changed="changed" />
      <DeckImportDialog v-model:open="importOpen" :deck="deck" @changed="changed" />
      <ExportDialog v-model:open="exportOpen" :load="loadExport" :filename="deck.name" :options="['printings', 'categories', 'tokens']" />
      <OptimizeDialog v-model:open="optimizeOpen" :deck="deck" :changes="optimizeChanges" @changed="changed" />
      <ExportDialog v-model:open="missingOpen" :load="loadMissing" :filename="`${deck.name} missing`" :options="['printings', 'other_decks']" />
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
