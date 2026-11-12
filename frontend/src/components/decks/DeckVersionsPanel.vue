<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, EyeIcon, GitBranchIcon, GitCompareArrowsIcon, PencilIcon, PlusIcon,
  RotateCcwIcon, SaveIcon, StarIcon, Trash2Icon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { api, fieldErrors, type Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConfirm } from '@/composables/useConfirm'
import { usePreference } from '@/composables/usePreference'
import type { DeckDetail } from '@/lib/decks'
import BranchNameDialog from './BranchNameDialog.vue'
import DeckCompareDialog from './DeckCompareDialog.vue'
import SaveVersionDialog from './SaveVersionDialog.vue'

/**
 * Branches and versions of a deck on the window's right edge (spec 027, AC-1 to AC-14),
 * built like the binder's Unplaced sidebar. Others see it read only.
 */
type Branch = Schemas['Branch']
type Version = Schemas['Version']
const props = defineProps<{ deck: DeckDetail; username: string | null; editable: boolean }>()
const emit = defineEmits<{ changed: [deck: DeckDetail]; reload: [] }>()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const pref = usePreference('deck.versions', 'closed', ['open', 'closed'] as const)
const shown = computed(() => pref.value === 'open')
const toggle = () => (pref.value = shown.value ? 'closed' : 'open')

const branches = ref<Branch[]>([])
async function reload() {
  const path = { id: props.deck.id }
  const { data } = props.username
    ? await api.GET('/api/users/{username}/decks/{id}/branches/', { params: { path: { ...path, username: props.username } } })
    : await api.GET('/api/decks/{id}/branches/', { params: { path } })
  if (data) branches.value = data.branches
}
// Card counts change with every edit; the deck object is replaced each time.
watch(() => props.deck, reload, { immediate: true })

const current = computed(() => branches.value.find((b) => b.id === props.deck.branch.id) ?? null)
const viewing = computed(() => props.deck.version?.id ?? null)
const label = (b: { name: string }, v?: { number: number } | null) => (v ? `${b.name} v${v.number}` : b.name)
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** The branch or version in the URL (AC-2, AC-8); Main has none. */
function go(query: { branch?: number; version?: number }, replace = false) {
  const main = branches.value.find((b) => b.is_main)
  const branch = query.branch && query.branch !== main?.id ? String(query.branch) : undefined
  const to = { query: { ...route.query, branch, version: query.version ? String(query.version) : undefined } }
  return replace ? router.replace(to) : router.push(to)
}
const showBranch = (b: Branch) => go({ branch: b.id })
const view = (v: Version) => go({ version: v.id })

// New branch, branch from a version, rename (AC-3, AC-4, AC-9) ------------------
const nameOpen = ref(false)
const nameDialog = ref<{ title: string; description?: string; action: string; initial?: string; save: (name: string) => Promise<Record<string, string> | null> }>({
  title: '', action: '', save: async () => null,
})
function askName(options: typeof nameDialog.value) {
  nameDialog.value = options
  nameOpen.value = true
}
async function create(name: string, from: { from_branch?: number; from_version?: number }) {
  const { data, error } = await api.POST('/api/decks/{id}/branches/', { params: { path: { id: props.deck.id } }, body: { name, ...from } })
  if (!data) return fieldErrors(error)
  branches.value = data.branches
  toast.success(`Branch ${name.trim()} created.`)
  go({ branch: data.created })
  return null
}
function newBranch() {
  const b = current.value
  if (!b) return
  askName({ title: 'New branch', description: `From ${b.name}`, action: 'Create', save: (name) => create(name, { from_branch: b.id }) })
}
function branchFrom(v: Version | Schemas['VersionRef']) {
  const b = branches.value.find((x) => x.versions.some((y) => y.id === v.id))
  if (!b) return
  askName({
    title: 'Branch from it', description: `From ${label(b, v)}`, action: 'Create', initial: `${b.name} v${v.number}`,
    save: (name) => create(name, { from_version: v.id }),
  })
}
function rename(b: Branch) {
  askName({
    title: 'Rename branch', action: 'Save', initial: b.name,
    save: async (name) => {
      const { data, error } = await api.PATCH('/api/decks/{id}/branches/{branch_id}/', { params: { path: { id: props.deck.id, branch_id: b.id } }, body: { name } })
      if (!data) return fieldErrors(error)
      branches.value = data.branches
      if (b.id === props.deck.branch.id) emit('changed', { ...props.deck, branch: { ...props.deck.branch, name: name.trim() } })
      return null
    },
  })
}
async function makeMain(b: Branch) {
  const main = branches.value.find((x) => x.is_main)
  const ok = await confirm({
    title: `Make ${b.name} Main?`, description: `${main?.name ?? 'Main'} becomes an ordinary branch. Wants, scanning, the deck box and Simulations use Main.`,
    action: 'Make Main', destructive: false,
  })
  if (!ok) return
  const { data } = await api.PATCH('/api/decks/{id}/branches/{branch_id}/', { params: { path: { id: props.deck.id, branch_id: b.id } }, body: { is_main: true } })
  if (!data) return toast.error('Could not make it Main.')
  branches.value = data.branches
  toast.success(`${b.name} is Main.`)
  // Still on the same list; the URL names no branch for Main.
  await go({ branch: props.deck.branch.id, version: viewing.value ?? undefined }, true)
  emit('reload')
}
async function deleteBranch(b: Branch) {
  const n = b.versions.length
  const ok = await confirm({ title: `Delete ${b.name}?`, description: n ? `Its ${n} ${n === 1 ? 'version goes' : 'versions go'} with it.` : undefined })
  if (!ok) return
  const { data } = await api.DELETE('/api/decks/{id}/branches/{branch_id}/', { params: { path: { id: props.deck.id, branch_id: b.id } } })
  if (!data) return toast.error('Could not delete the branch.')
  branches.value = data.branches
  toast.success(`Deleted ${b.name}.`)
  if (b.id === props.deck.branch.id) router.replace({ query: { ...route.query, branch: undefined, version: undefined } })
}

// Versions (AC-7, AC-10, AC-11) ------------------------------------------------
const saveOpen = ref(false)
async function saveVersion(name: string, note: string) {
  const b = current.value!
  const { data } = await api.POST('/api/decks/{id}/branches/{branch_id}/versions/', { params: { path: { id: props.deck.id, branch_id: b.id } }, body: { name, note } })
  if (!data) {
    toast.error('Could not save the version.')
    return false
  }
  branches.value = data.branches
  const saved = data.branches.find((x) => x.id === b.id)?.versions[0]
  toast.success(`Saved ${label(b, saved)}.`)
  return true
}
async function restore(v: Version | Schemas['VersionRef']) {
  const b = branches.value.find((x) => x.versions.some((y) => y.id === v.id))
  if (!b) return
  const ok = await confirm({
    title: `Restore ${label(b, v)}?`, description: `${b.name}'s list now is saved first, as "Before restoring v${v.number}".`, action: 'Restore', destructive: false,
  })
  if (!ok) return
  const { data } = await api.POST('/api/decks/{id}/versions/{version_id}/restore/', { params: { path: { id: props.deck.id, version_id: v.id } } })
  if (!data) return toast.error('Could not restore.')
  toast.success(`Restored ${label(b, v)}.`)
  if (viewing.value) go({ branch: b.id })
  emit('changed', data)
}
async function deleteVersion(v: Version) {
  const b = current.value!
  const ok = await confirm({ title: `Delete ${label(b, v)}?` })
  if (!ok) return
  const { data } = await api.DELETE('/api/decks/{id}/versions/{version_id}/', { params: { path: { id: props.deck.id, version_id: v.id } } })
  if (!data) return toast.error('Could not delete the version.')
  branches.value = data.branches
  toast.success(`Deleted ${label(b, v)}.`)
  if (viewing.value === v.id) go({ branch: b.id })
}

// Compare (AC-12) ---------------------------------------------------------------
const compareOpen = ref(false)
const compareStart = ref({ a: '', b: '' })
function compare(v?: Version) {
  const now = `branch:${props.deck.branch.id}`
  const first = v ?? current.value?.versions[0]
  // No version yet: against Main, or Main against another branch.
  const other = branches.value.find((b) => b.is_main && b.id !== props.deck.branch.id) ?? branches.value.find((b) => b.id !== props.deck.branch.id)
  compareStart.value = { a: first ? `version:${first.id}` : other ? `branch:${other.id}` : now, b: now }
  compareOpen.value = true
}

defineExpose({ restore, branchFrom, open: () => (pref.value = 'open') })
</script>

<template>
  <div class="contents" data-testid="versions-panel" :data-state="shown ? 'open' : 'closed'">
    <Transition
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      enter-from-class="translate-x-full"
      leave-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
      leave-to-class="translate-x-full"
    >
      <aside v-if="shown" id="versions-panel" class="fixed inset-y-0 right-0 z-30 grid w-72 content-start gap-5 overflow-y-auto border-l bg-card p-4 shadow-xl">
        <section class="grid gap-1">
          <div class="flex items-center gap-1">
            <h2 class="mr-auto text-sm font-medium text-muted-foreground">Branches</h2>
            <IconButton label="Compare" data-testid="compare" @click="compare()"><GitCompareArrowsIcon /></IconButton>
            <IconButton v-if="editable" label="New branch" data-testid="new-branch" @click="newBranch"><PlusIcon /></IconButton>
          </div>
          <ul class="grid gap-0.5">
            <li
              v-for="b in branches" :key="b.id" class="group flex items-center gap-1 rounded-md pr-1"
              :class="b.id === deck.branch.id ? 'bg-muted' : 'hover:bg-muted/60'" data-testid="branch" :data-current="b.id === deck.branch.id"
            >
              <button type="button" class="grid min-w-0 flex-1 px-2 py-1.5 text-left" @click="showBranch(b)">
                <span class="flex items-center gap-1.5">
                  <GitBranchIcon class="size-3.5 shrink-0 text-muted-foreground" />
                  <span class="truncate text-sm font-medium" data-testid="branch-name">{{ b.name }}</span>
                  <StarIcon v-if="b.is_main" class="size-3.5 shrink-0 fill-current text-amber-500" aria-label="Main" />
                  <span class="ml-auto text-xs text-muted-foreground tabular-nums">{{ b.cards }}</span>
                </span>
                <span v-if="b.from_label" class="truncate pl-5 text-xs text-muted-foreground" data-testid="branch-from">from {{ b.from_label }}</span>
              </button>
              <DropdownMenu v-if="editable">
                <DropdownMenuTrigger as-child>
                  <IconButton label="Branch actions" class="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100" data-testid="branch-menu"><EllipsisIcon /></IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="rename(b)"><PencilIcon /> Rename</DropdownMenuItem>
                  <template v-if="!b.is_main">
                    <DropdownMenuItem @select="makeMain(b)"><StarIcon /> Make Main</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" @select="deleteBranch(b)"><Trash2Icon /> Delete</DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </section>

        <section v-if="current" class="grid gap-1">
          <div class="flex items-center gap-1">
            <h2 class="mr-auto truncate text-sm font-medium text-muted-foreground">Versions</h2>
            <IconButton v-if="editable" label="Save version" data-testid="save-version" @click="saveOpen = true"><SaveIcon /></IconButton>
          </div>
          <p v-if="!current.versions.length" class="px-2 py-1.5 text-sm text-muted-foreground">None yet</p>
          <ul class="grid gap-0.5">
            <li
              v-for="v in current.versions" :key="v.id" class="group flex items-center gap-1 rounded-md pr-1"
              :class="v.id === viewing ? 'bg-muted' : 'hover:bg-muted/60'" data-testid="version" :data-current="v.id === viewing"
            >
              <Tooltip :disabled="!v.note">
                <TooltipTrigger as-child>
                  <button type="button" class="grid min-w-0 flex-1 px-2 py-1.5 text-left" @click="view(v)">
                    <span class="flex items-baseline gap-1.5 text-sm">
                      <span class="font-medium tabular-nums" data-testid="version-number">v{{ v.number }}</span>
                      <span class="truncate" data-testid="version-name">{{ v.name }}</span>
                      <span class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{{ v.cards }}</span>
                    </span>
                    <span class="text-xs text-muted-foreground">{{ date(v.created_at) }}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" class="max-w-64 whitespace-pre-line">{{ v.note }}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <IconButton label="Version actions" class="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100" data-testid="version-menu"><EllipsisIcon /></IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="view(v)"><EyeIcon /> View</DropdownMenuItem>
                  <DropdownMenuItem @select="compare(v)"><GitCompareArrowsIcon /> Compare</DropdownMenuItem>
                  <template v-if="editable">
                    <DropdownMenuItem @select="branchFrom(v)"><GitBranchIcon /> Branch from it</DropdownMenuItem>
                    <DropdownMenuItem @select="restore(v)"><RotateCcwIcon /> Restore</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" @select="deleteVersion(v)"><Trash2Icon /> Delete</DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </section>
      </aside>
    </Transition>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="fixed top-1/2 z-30 flex -translate-y-1/2 items-center rounded-l-xl border border-r-0 bg-background px-1.5 py-6 text-muted-foreground shadow-lg transition-[right,color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
          :class="shown ? 'right-72' : 'right-0'"
          :aria-label="shown ? 'Hide versions' : 'Show versions'" :aria-expanded="shown" aria-controls="versions-panel"
          data-testid="versions-tab" @click="toggle"
        >
          <ChevronRightIcon v-if="shown" class="size-6" />
          <ChevronLeftIcon v-else class="size-6" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{{ shown ? 'Hide versions' : 'Show versions' }}</TooltipContent>
    </Tooltip>

    <BranchNameDialog v-model:open="nameOpen" v-bind="nameDialog" />
    <SaveVersionDialog v-if="current" v-model:open="saveOpen" :branch="current.name" :save="saveVersion" />
    <DeckCompareDialog v-model:open="compareOpen" :deck-id="deck.id" :username="username" :branches="branches" :start="compareStart" />
  </div>
</template>
