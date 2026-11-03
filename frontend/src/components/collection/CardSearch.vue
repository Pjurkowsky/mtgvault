<script setup lang="ts">
import { ref, watch } from 'vue'
import { LayoutGridIcon, ListIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardPreview from '@/components/CardPreview.vue'
import ExpandButton from '@/components/ExpandButton.vue'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePreference } from '@/composables/usePreference'
import { cn } from '@/lib/utils'

/**
 * Card search with grid or list results (spec 002, AC-7 to AC-9). Used by Add
 * card, a deck's Add card and Propose swap (spec 005, AC-1, AC-9).
 * `picked` hides the results while the parent shows the chosen card.
 */
defineProps<{ picked?: boolean }>()
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{ choose: [result: Schemas['CardSearchResult']] }>()

// Result layout, remembered per browser.
const view = usePreference('add.view', 'grid', ['grid', 'list'] as const)
const size = usePreference('add.size', 'md', ['sm', 'md', 'lg'] as const)
const GRID_COLUMNS = { sm: 'grid-cols-4 sm:grid-cols-6', md: 'grid-cols-3 sm:grid-cols-4', lg: 'grid-cols-2 sm:grid-cols-3' }

const results = ref<Schemas['CardSearchResult'][]>([])
const searching = ref(false)
const input = ref<InstanceType<typeof Input> | null>(null)

let timer: ReturnType<typeof setTimeout>
let searchId = 0
watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) return (results.value = [])
  timer = setTimeout(async () => {
    const mine = ++searchId
    searching.value = true
    const { data } = await api.GET('/api/catalog/cards/', { params: { query: { q } } })
    if (mine !== searchId) return
    searching.value = false
    results.value = data ?? []
  }, 200)
}, { immediate: true })

defineExpose({ focus: () => (input.value?.$el as HTMLInputElement | undefined)?.focus() })
</script>

<template>
  <div class="flex gap-2">
    <Input ref="input" v-model="query" placeholder="Card name" aria-label="Card name" autocomplete="off" autofocus />
    <template v-if="!picked">
      <ToggleGroup type="single" variant="outline" :model-value="view" @update:model-value="(v) => v && (view = v as 'grid' | 'list')">
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="grid" aria-label="Results as grid"><LayoutGridIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Results as grid</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child><ToggleGroupItem value="list" aria-label="Results as list"><ListIcon /></ToggleGroupItem></TooltipTrigger>
          <TooltipContent>Results as list</TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <ToggleGroup v-if="view === 'grid'" type="single" variant="outline" :model-value="size" aria-label="Card size" @update:model-value="(v) => v && (size = v as 'sm' | 'md' | 'lg')">
        <ToggleGroupItem value="sm" aria-label="Small cards">S</ToggleGroupItem>
        <ToggleGroupItem value="md" aria-label="Medium cards">M</ToggleGroupItem>
        <ToggleGroupItem value="lg" aria-label="Large cards">L</ToggleGroupItem>
      </ToggleGroup>
    </template>
  </div>

  <template v-if="!picked && results.length">
    <ul v-if="view === 'grid'" :class="cn('grid gap-3', GRID_COLUMNS[size])" data-testid="card-results" :data-size="size">
      <li v-for="r in results" :key="r.oracle_id" class="group relative">
        <ExpandButton :image="r.image_normal" :name="r.name" />
        <CardPreview :image="r.image_normal" :name="r.name">
          <button type="button" class="block w-full" :aria-label="r.name" @click="emit('choose', r)">
            <img :src="size === 'sm' ? r.image_small : r.image_normal || r.image_small" :alt="r.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted object-cover transition hover:ring-2 hover:ring-primary" />
          </button>
        </CardPreview>
      </li>
    </ul>
    <ul v-else class="grid max-h-96 gap-1 overflow-y-auto" data-testid="card-results">
      <li v-for="r in results" :key="r.oracle_id" class="group relative">
        <ExpandButton :image="r.image_normal" :name="r.name" />
        <CardPreview :image="r.image_normal" :name="r.name">
          <button type="button" class="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted" :aria-label="r.name" @click="emit('choose', r)">
            <img :src="r.image_small" alt="" class="h-14 rounded-sm" loading="lazy" />
            <span>{{ r.name }}</span>
          </button>
        </CardPreview>
      </li>
    </ul>
  </template>
  <p v-else-if="!picked && query.trim().length >= 2 && !searching" class="text-sm text-muted-foreground">No cards found.</p>
</template>
