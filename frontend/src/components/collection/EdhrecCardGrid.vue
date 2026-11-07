<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Schemas } from '@/api/client'
import CardMenu from '@/components/browser/CardMenu.vue'
import CardPreview from '@/components/CardPreview.vue'
import ExpandButton from '@/components/ExpandButton.vue'
import { Button } from '@/components/ui/button'

type Card = Schemas['EdhrecCard'] & { share?: number }

/**
 * EDHREC cards: click opens the card, ⤢ shows it full screen, right-click opens a menu with
 * Open and, in a deck, Propose swap (spec 011, AC-10). Long lists start short to keep tabs snappy.
 */
const props = withDefaults(defineProps<{ cards: Card[]; limit?: number; testid?: string; swappable?: boolean }>(), { limit: 15 })
const emit = defineEmits<{ open: [oracleId: string]; swap: [oracleId: string] }>()
// Let the menu close and hand back focus before a dialog or request follows.
const later = (fn: () => void) => setTimeout(fn)

const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.cards : props.cards.slice(0, props.limit)))
const pct = (share?: number) => (share === undefined ? '' : `${Math.round(share * 100)}% of decks`)
</script>

<template>
  <div class="grid gap-3">
    <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5" :data-testid="testid">
      <li v-for="c in visible" :key="c.name" class="group relative">
        <ExpandButton :image="c.image_normal" :name="c.name" />
        <!-- Cards EDHREC can't match to the catalog only show. -->
        <component
          :is="c.oracle_id ? CardMenu : 'div'" :editable="true" :items="swappable ? ['open', 'swap'] : ['open']"
          @open="later(() => emit('open', c.oracle_id!))" @swap="later(() => emit('swap', c.oracle_id!))"
        >
          <CardPreview :image="c.image_normal" :name="c.name">
            <button
              type="button" class="block w-full text-left disabled:cursor-default" :disabled="!c.oracle_id"
              :aria-label="c.name" data-testid="edhrec-card" @click="c.oracle_id && emit('open', c.oracle_id)"
            >
              <img v-if="c.image_small" :src="c.image_small" :alt="c.name" loading="lazy" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
              <span v-else class="flex aspect-[488/680] items-center rounded-md bg-muted p-2 text-xs">{{ c.name }}</span>
              <span v-if="c.share !== undefined" class="mt-1 block text-xs text-muted-foreground">{{ pct(c.share) }}</span>
            </button>
          </CardPreview>
        </component>
      </li>
    </ul>
    <Button v-if="cards.length > limit && !expanded" variant="ghost" size="sm" class="justify-self-start" @click="expanded = true">
      Show all {{ cards.length }}
    </Button>
  </div>
</template>
