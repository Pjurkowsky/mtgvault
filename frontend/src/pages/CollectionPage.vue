<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PlusIcon } from '@lucide/vue'
import CardBrowser from '@/components/browser/CardBrowser.vue'
import DeleteLocationDialog from '@/components/collection/DeleteLocationDialog.vue'
import LocationDialog from '@/components/collection/LocationDialog.vue'
import LocationGrid from '@/components/collection/LocationGrid.vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocationsStore, type Location } from '@/stores/locations'

const route = useRoute()
const router = useRouter()
const store = useLocationsStore()
const tab = computed(() => (route.name === 'cards' ? 'cards' : 'collection'))

const editing = ref<Location | null>(null)
const dialogOpen = ref(false)
const deleting = ref<Location | null>(null)
const deleteOpen = ref(false)

onMounted(store.load)

function openCreate() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(location: { id: number }) {
  editing.value = store.byId(location.id) ?? null
  dialogOpen.value = true
}
function openDelete(location: { id: number }) {
  deleting.value = store.byId(location.id) ?? null
  deleteOpen.value = true
}
</script>

<template>
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Tabs :model-value="tab" @update:model-value="(v) => router.push({ name: String(v) })">
        <TabsList>
          <TabsTrigger value="collection">Locations</TabsTrigger>
          <TabsTrigger value="cards">All cards</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button v-if="tab === 'collection'" @click="openCreate"><PlusIcon /> New location</Button>
    </div>

    <template v-if="tab === 'collection'">
      <LocationGrid
        :locations="store.locations" :unfiled="store.unfiled" :cart="store.cart" :currency="store.currency" editable
        :to="(l) => ({ name: 'location', params: { id: l.id } })"
        @edit="openEdit" @delete="openDelete"
      />
      <LocationDialog v-model:open="dialogOpen" :location="editing" />
      <DeleteLocationDialog v-model:open="deleteOpen" :location="deleting" />
    </template>

    <CardBrowser v-else :source="{ kind: 'own' }" @changed="store.load" />
  </div>
</template>
