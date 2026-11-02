<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { EllipsisIcon, GlobeIcon, InboxIcon } from '@lucide/vue'
import IconButton from '@/components/IconButton.vue'
import Price from '@/components/Price.vue'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { kindOf } from '@/lib/cards'
import type { Money } from '@/lib/money'

type Tile = { id: number; name: string; kind: string; card_count: number; value: number | null; values?: Money; is_public?: boolean }

defineProps<{
  locations: Tile[]
  currency: string
  to: (location: Tile) => RouteLocationRaw
  unfiled?: { card_count: number; value: number | null; values?: Money }
  editable?: boolean
}>()
const emit = defineEmits<{ edit: [location: Tile]; delete: [location: Tile] }>()

const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`
</script>

<template>
  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="location-grid">
    <li v-for="location in locations" :key="location.id">
      <Card class="relative gap-2 p-4 transition-colors hover:bg-muted/50" data-testid="location-tile">
        <div class="flex items-start gap-3">
          <component :is="kindOf(location.kind)?.icon" class="mt-0.5 size-5 shrink-0 text-muted-foreground" :aria-label="kindOf(location.kind)?.label" />
          <RouterLink :to="to(location)" class="min-w-0 flex-1 font-medium after:absolute after:inset-0">
            <span class="block truncate">{{ location.name }}</span>
          </RouterLink>
          <GlobeIcon v-if="location.is_public" class="size-4 shrink-0 text-muted-foreground" aria-label="Public" />
          <DropdownMenu v-if="editable">
            <DropdownMenuTrigger as-child>
              <IconButton label="Options" variant="ghost" class="relative z-10 -mt-1 -mr-2 size-7" :aria-label="`${location.name} options`">
                <EllipsisIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="emit('edit', location)">Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" @select="emit('delete', location)">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p class="pl-8 text-sm text-muted-foreground">
          <span data-testid="location-count">{{ cards(location.card_count) }}</span> ·
          <span data-testid="location-value" class="relative z-10"><Price :value="location.value" :values="location.values" :currency="currency" /></span>
        </p>
      </Card>
    </li>

    <li v-if="unfiled">
      <Card class="relative gap-2 p-4 transition-colors hover:bg-muted/50" data-testid="location-tile">
        <div class="flex items-start gap-3">
          <InboxIcon class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <RouterLink :to="{ name: 'location', params: { id: 'unfiled' } }" class="flex-1 font-medium after:absolute after:inset-0">
            Unfiled
          </RouterLink>
        </div>
        <p class="pl-8 text-sm text-muted-foreground">
          <span data-testid="location-count">{{ cards(unfiled.card_count) }}</span> ·
          <span data-testid="location-value" class="relative z-10"><Price :value="unfiled.value" :values="unfiled.values" :currency="currency" /></span>
        </p>
      </Card>
    </li>
  </ul>
</template>
