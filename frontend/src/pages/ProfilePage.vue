<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Schemas } from '@/api/client'
import LocationGrid from '@/components/collection/LocationGrid.vue'

const route = useRoute()
const profile = ref<Schemas['PublicUser'] | null>(null)
const locations = ref<Schemas['PublicLocationList'] | null>(null)
const state = ref<'loading' | 'found' | 'missing'>('loading')

watch(
  () => route.params.username as string,
  async (username) => {
    state.value = 'loading'
    const [user, list] = await Promise.all([
      api.GET('/api/users/{username}/', { params: { path: { username } } }),
      api.GET('/api/users/{username}/locations/', { params: { path: { username } } }),
    ])
    profile.value = user.data ?? null
    locations.value = list.data ?? null
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
  </div>
  <div v-else-if="state === 'missing'" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">User not found</h1>
    <p class="text-muted-foreground">No user is called "{{ route.params.username }}".</p>
  </div>
</template>
