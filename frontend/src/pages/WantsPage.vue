<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon, GlobeIcon, HeartIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import Price from '@/components/Price.vue'
import { useLocationsStore } from '@/stores/locations'

/** The want list, yours or someone's public one (spec 010, AC-7, AC-8, AC-18). */
const route = useRoute()
const store = useLocationsStore()
const username = computed(() => (route.name === 'public-wants' ? String(route.params.username) : null))

const isPublic = ref(false)
const publicTotals = ref<Schemas['Totals'] | null>(null)
const publicCurrency = ref('USD')
const state = ref<'loading' | 'found' | 'missing'>('loading')

async function load() {
  if (username.value) {
    const { data } = await api.GET('/api/users/{username}/locations/', { params: { path: { username: username.value } } })
    publicTotals.value = data?.wants ?? null
    publicCurrency.value = data?.currency ?? 'USD'
    state.value = data?.wants ? 'found' : 'missing'
    return
  }
  const [, settings] = await Promise.all([store.load(), api.GET('/api/wants/settings/')])
  isPublic.value = settings.data?.is_public ?? false
  state.value = 'found'
}
watch(username, load, { immediate: true })

const totals = computed(() => (username.value ? publicTotals.value : store.wants))
const currency = computed(() => (username.value ? publicCurrency.value : store.currency))
const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`
</script>

<template>
  <div v-if="state === 'missing'" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">Want list not found</h1>
  </div>
  <div v-else-if="state === 'found'" class="grid gap-6">
    <div class="grid gap-2">
      <RouterLink
        :to="username ? { name: 'profile', params: { username } } : { name: 'collection' }"
        class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon class="size-4" /> {{ username ?? 'Locations' }}
      </RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <HeartIcon class="size-6 text-muted-foreground" />
        <h1 class="text-2xl font-semibold" data-testid="location-name">Want list</h1>
        <GlobeIcon v-if="isPublic && !username" class="size-4 text-muted-foreground" aria-label="Public" data-testid="wants-public" />
      </div>
      <p v-if="totals" class="text-muted-foreground" data-testid="location-totals">
        {{ cards(totals.card_count) }} · <Price :value="totals.value" :values="totals.values" :currency="currency" />
      </p>
    </div>

    <CardBrowser
      :key="username ?? 'own'" :source="username ? { kind: 'public-wants', username } : { kind: 'wants' }"
      @changed="load"
    />
  </div>
</template>
