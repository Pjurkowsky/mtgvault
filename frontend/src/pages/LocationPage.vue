<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, GlobeIcon } from '@lucide/vue'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import DeleteLocationDialog from '@/components/collection/DeleteLocationDialog.vue'
import LocationDialog from '@/components/collection/LocationDialog.vue'
import { Button } from '@/components/ui/button'
import { kindOf } from '@/lib/cards'
import Price from '@/components/Price.vue'
import { useLocationsStore } from '@/stores/locations'

const route = useRoute()
const router = useRouter()
const store = useLocationsStore()

const id = computed(() => String(route.params.id))
const isUnfiled = computed(() => id.value === 'unfiled')
const isCart = computed(() => id.value === 'cart')
const location = computed(() => (isUnfiled.value || isCart.value ? null : store.byId(Number(id.value))))
const totals = computed(() => (isCart.value ? store.cart : isUnfiled.value ? store.unfiled : location.value))
const missing = computed(() => store.loaded && !isUnfiled.value && !isCart.value && !location.value)

const editOpen = ref(false)
const deleteOpen = ref(false)

onMounted(store.load)
const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`
</script>

<template>
  <div v-if="missing" class="py-16 text-center">
    <h1 class="text-2xl font-semibold">Location not found</h1>
  </div>
  <div v-else-if="store.loaded" class="grid gap-6">
    <div class="grid gap-2">
      <RouterLink :to="{ name: 'collection' }" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon class="size-4" /> Locations
      </RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <component :is="kindOf(location?.kind)?.icon" v-if="location" class="size-6 text-muted-foreground" />
        <h1 class="text-2xl font-semibold" data-testid="location-name">{{ location?.name ?? (isCart ? 'Cart' : 'Unfiled') }}</h1>
        <span v-if="location" class="text-sm text-muted-foreground" data-testid="location-kind">{{ kindOf(location.kind)?.label }}</span>
        <GlobeIcon v-if="location?.is_public" class="size-4 text-muted-foreground" aria-label="Public" />
        <div v-if="location" class="ml-auto flex gap-2">
          <Button variant="outline" size="sm" @click="editOpen = true">Edit</Button>
          <Button variant="outline" size="sm" class="text-destructive" @click="deleteOpen = true">Delete</Button>
        </div>
      </div>
      <p v-if="totals" class="text-muted-foreground" data-testid="location-totals">
        {{ cards(totals.card_count) }} · <Price :value="totals.value" :values="totals.values" :currency="store.currency" />
      </p>
    </div>

    <CardBrowser :key="id" :source="{ kind: 'own' }" :location="id" @changed="store.load" />

    <template v-if="location">
      <LocationDialog v-model:open="editOpen" :location="location" />
      <DeleteLocationDialog v-model:open="deleteOpen" :location="location" @deleted="router.push({ name: 'collection' })" />
    </template>
  </div>
</template>
