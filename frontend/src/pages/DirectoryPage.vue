<script setup lang="ts">
import { ref, watch } from 'vue'
import { SearchIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import { Input } from '@/components/ui/input'

const query = ref('')
const users = ref<Schemas['DirectoryUser'][] | null>(null)

let timer: ReturnType<typeof setTimeout>
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const { data } = await api.GET('/api/users/', { params: { query: { q: q.trim() || undefined } } })
    users.value = data ?? []
  }, query.value ? 200 : 0)
}, { immediate: true })

const plural = (n: number, word: string) => `${n} public ${word}${n === 1 ? '' : 's'}`
/** Only the non-zero counts (spec 004, AC-28). */
const counts = (u: Schemas['DirectoryUser']) =>
  [u.public_locations ? plural(u.public_locations, 'location') : '', u.public_decks ? plural(u.public_decks, 'deck') : '']
    .filter(Boolean).join(' · ')
</script>

<!-- Users with at least one public location or deck (spec 001 AC-54, spec 004 AC-28). -->
<template>
  <div class="mx-auto grid max-w-xl gap-4">
    <div class="relative">
      <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="query" type="search" placeholder="Search users" aria-label="Search users" class="pl-8" />
    </div>
    <ul v-if="users?.length" class="divide-y rounded-md border" data-testid="directory">
      <li v-for="u in users" :key="u.username">
        <RouterLink :to="{ name: 'profile', params: { username: u.username } }" class="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
          <span class="font-medium">{{ u.username }}</span>
          <span class="text-sm text-muted-foreground">{{ counts(u) }}</span>
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="users" class="py-12 text-center text-muted-foreground">No public collections{{ query ? ' match' : ' yet' }}.</p>
  </div>
</template>
