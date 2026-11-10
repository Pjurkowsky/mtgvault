<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { PlusIcon, UploadIcon } from '@lucide/vue'
import { api, type Schemas } from '@/api/client'
import DeckTile from '@/components/decks/DeckTile.vue'
import NewDeckDialog from '@/components/decks/NewDeckDialog.vue'
import { Button } from '@/components/ui/button'

/** Decks (spec 004, AC-1). */
const list = ref<Schemas['DeckList'] | null>(null)
const newOpen = ref(false)
const importOpen = ref(false)

onMounted(async () => {
  const { data } = await api.GET('/api/decks/')
  list.value = data ?? null
})
</script>

<template>
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center justify-end gap-3">
      <div class="flex gap-2">
        <Button variant="outline" @click="importOpen = true"><UploadIcon /> Import deck</Button>
        <Button @click="newOpen = true"><PlusIcon /> New deck</Button>
      </div>
    </div>
    <ul v-if="list?.decks.length" class="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13rem,16rem))]" data-testid="deck-grid">
      <li v-for="deck in list.decks" :key="deck.id">
        <DeckTile :deck="deck" :currency="list.currency" :to="{ name: 'deck', params: { id: deck.id } }" />
      </li>
    </ul>
    <p v-else-if="list" class="py-16 text-center text-muted-foreground">No decks yet.</p>
    <NewDeckDialog v-model:open="newOpen" />
    <NewDeckDialog v-model:open="importOpen" with-import />
  </div>
</template>
