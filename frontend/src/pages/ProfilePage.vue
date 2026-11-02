<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Schemas } from '@/api/client'
import LocationGrid from '@/components/collection/LocationGrid.vue'
import DeckTile from '@/components/decks/DeckTile.vue'

const route = useRoute()
const profile = ref<Schemas['PublicUser'] | null>(null)
const locations = ref<Schemas['PublicLocationList'] | null>(null)
const decks = ref<Schemas['DeckList'] | null>(null)
const state = ref<'loading' | 'found' | 'missing'>('loading')

watch(
  () => route.params.username as string,
  async (username) => {
    state.value = 'loading'
    const [user, list, deckList] = await Promise.all([
      api.GET('/api/users/{username}/', { params: { path: { username } } }),
      api.GET('/api/users/{username}/locations/', { params: { path: { username } } }),
      api.GET('/api/users/{username}/decks/', { params: { path: { username } } }),
    ])
    profile.value = user.data ?? null
    locations.value = list.data ?? null
    decks.value = deckList.data ?? null
    state.value = user.data ? 'found' : 'missing'
  },
  { immediate: true },
)

const joined = (iso?: string) =>
  iso && new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <div v-if="state === 'found' && profile" class="grid gap-6">
    <div>
      <h1 class="text-2xl font-semibold" data-testid="profile-username">{{ profile.username }}</h1>
      <p class="text-muted-foreground">Joined {{ joined(profile.date_joined) }}</p>
    </div>
    <LocationGrid
      v-if="locations?.locations.length"
      :locations="locations.locations" :currency="locations.currency"
      :to="(l) => ({ name: 'public-location', params: { username: profile!.username, id: l.id } })"
    />
    <section v-if="decks?.decks.length" class="grid gap-3">
      <h2 class="text-lg font-semibold">Decks</h2>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="profile-decks">
        <li v-for="deck in decks.decks" :key="deck.id">
          <DeckTile :deck="deck" :currency="decks.currency" :to="{ name: 'public-deck', params: { username: profile.username, id: deck.id } }" />
        </li>
      </ul>
    </section>
  </div>
  <div v-else-if="state === 'missing'" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">User not found</h1>
    <p class="text-muted-foreground">No user is called "{{ route.params.username }}".</p>
  </div>
</template>
