<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import { Skeleton } from '@/components/ui/skeleton'
import { productYear } from '@/lib/products'

/** Every card a product can hold, in the collection card browser (spec 030, AC-8 to AC-11). */
const route = useRoute()
const code = computed(() => String(route.params.code))
// Back to the deck the product was opened from (AC-8): only paths inside the app.
const from = computed(() => {
  const f = route.query.from
  return typeof f === 'string' && f.startsWith('/') && !f.startsWith('//') ? f : null
})
const product = ref<Schemas['ProductDetail'] | null>(null)
const missing = ref(false)

watch(code, async (c) => {
  product.value = null
  missing.value = false
  const { data } = await api.GET('/api/products/{code}/', { params: { path: { code: c } } })
  product.value = data ?? null
  missing.value = !data
}, { immediate: true })
</script>

<template>
  <div class="grid gap-4">
    <RouterLink v-if="from" :to="from" class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="product-back">
      <ArrowLeftIcon class="size-4" /> Deck
    </RouterLink>
    <p v-if="missing" class="py-16 text-center text-muted-foreground" data-testid="product-missing">No such product.</p>
    <template v-else-if="product">
      <div class="flex items-center gap-3">
        <img v-if="product.image" :src="product.image" :alt="product.name" class="max-h-20 max-w-16 shrink-0 object-contain" data-testid="product-photo" />
        <div class="min-w-0">
        <h1 class="text-2xl font-semibold" data-testid="product-title">{{ product.name }}</h1>
        <p class="text-sm text-muted-foreground" data-testid="product-meta">
          {{ product.set_name }} · {{ productYear(product) }}<template v-if="product.deck_type"> · {{ product.deck_type }}</template>
          · {{ product.count }} {{ product.count === 1 ? 'card' : 'cards' }}
        </p>
        </div>
      </div>
      <CardBrowser :key="product.code" :source="{ kind: 'product', code: product.code, booster: product.kind === 'booster' }" readonly />
    </template>
    <Skeleton v-else class="h-8 w-64" />
  </div>
</template>
