<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import { kindOf } from '@/lib/cards'
import { formatMoney } from '@/lib/money'

const route = useRoute()
const username = computed(() => String(route.params.username))
const id = computed(() => Number(route.params.id))
const location = ref<Schemas['PublicLocation'] | null>(null)
const currency = ref('USD')
const state = ref<'loading' | 'found' | 'missing'>('loading')

async function load() {
  state.value = 'loading'
  const { data } = await api.GET('/api/users/{username}/locations/{id}/', {
    params: { path: { username: username.value, id: id.value } },
  })
  location.value = data ?? null
  state.value = data ? 'found' : 'missing'
  // The list endpoint reports the viewer's currency.
  const list = await api.GET('/api/users/{username}/locations/', { params: { path: { username: username.value } } })
  currency.value = list.data?.currency ?? 'USD'
}
watch([username, id], load, { immediate: true })
const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`
</script>

<!-- Read-only view of someone's public location (AC-56 to AC-59). -->
<template>
  <div v-if="state === 'missing'" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">Not found</h1>
  </div>
  <div v-else-if="state === 'found' && location" class="grid gap-6">
    <div class="grid gap-2">
      <RouterLink :to="{ name: 'profile', params: { username } }" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon class="size-4" /> {{ username }}
      </RouterLink>
      <div class="flex items-center gap-3">
        <component :is="kindOf(location.kind)?.icon" class="size-6 text-muted-foreground" />
        <h1 class="text-2xl font-semibold" data-testid="location-name">{{ location.name }}</h1>
      </div>
      <p class="text-muted-foreground" data-testid="location-totals">{{ cards(location.card_count) }} · {{ formatMoney(location.value, currency) }}</p>
    </div>
    <CardBrowser :key="`${username}/${id}`" :source="{ kind: 'public', username, locationId: id }" readonly />
  </div>
</template>
