<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PencilIcon, Trash2Icon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import DestructiveButton from '@/components/DestructiveButton.vue'
import IconButton from '@/components/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ZONE_LABELS, zonesForCard, type DeckCard, type DeckDetail, type Zone } from '@/lib/decks'
import OwnershipBadge from './OwnershipBadge.vue'

/** The deck part of the card dialog: ownership with copies, quantity, zone, remove (spec 005, AC-3, AC-5). */
const props = defineProps<{ deck: DeckDetail; card: DeckCard; readonly?: boolean; busy?: boolean }>()
const emit = defineEmits<{
  save: [patch: { quantity: number; zone: Zone }]
  remove: []
  move: [copy: Schemas['FreeCopy'], quantity: number]
  'add-copy': []
  'edit-copy': [itemId: number]
  'delete-copy': [itemId: number]
}>()
const ACTIVE = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

const quantity = ref(1)
const zone = ref<Zone>('main')
watch(() => props.card, (c) => {
  quantity.value = c.quantity
  zone.value = c.zone as Zone
}, { immediate: true })

const own = computed(() => props.card.ownership)
const short = computed(() => Math.max(0, own.value.needed - own.value.in_box))
const zones = computed(() => zonesForCard(props.deck.format, props.card.printing))
const dirty = computed(() => quantity.value !== props.card.quantity || zone.value !== props.card.zone)
</script>

<template>
  <section class="grid gap-4" data-testid="deck-section">
    <div class="grid gap-2" data-testid="deck-card-ownership">
      <OwnershipBadge :card="card" show-label />
      <ul class="grid gap-1 text-sm">
        <li v-if="own.in_box && !own.box_copies.length">{{ own.in_box }} in the deck box</li>
        <li v-for="c in [...own.box_copies, ...own.free_copies]" :key="c.item_id" class="flex items-center gap-2" data-testid="deck-copy">
          <span class="flex-1">{{ c.quantity }} in {{ c.location }} <span class="text-muted-foreground uppercase">({{ c.set_code }} #{{ c.collector_number }})</span></span>
          <Button
            v-if="!readonly && deck.location && short > 0 && c.location_id !== deck.location" size="sm" variant="outline" :disabled="busy"
            @click="emit('move', c, Math.min(short, c.quantity))"
          >Move to deck box</Button>
          <template v-if="!readonly">
            <IconButton :label="`Edit ${c.quantity} in ${c.location}`" variant="ghost" class="size-7" @click="emit('edit-copy', c.item_id)"><PencilIcon /></IconButton>
            <IconButton :label="`Delete ${c.quantity} in ${c.location}`" variant="ghost" class="size-7 text-destructive" @click="emit('delete-copy', c.item_id)"><Trash2Icon /></IconButton>
          </template>
        </li>
        <li v-for="d in own.other_decks" :key="d.deck">{{ d.quantity }} in deck {{ d.deck }}</li>
        <li v-if="own.missing" class="text-destructive">{{ own.missing }} missing</li>
      </ul>
      <Button v-if="!readonly" size="sm" variant="outline" class="justify-self-start" :disabled="busy" @click="emit('add-copy')">
        Add a new copy{{ deck.location ? ' to the deck box' : '' }}
      </Button>
    </div>

    <template v-if="!readonly">
      <Separator />
      <div class="grid grid-cols-[6rem_1fr] items-center gap-3">
        <Label for="deck-card-qty">Quantity</Label>
        <Input id="deck-card-qty" v-model.number="quantity" type="number" min="1" max="999" class="w-24" />
        <Label id="deck-card-zone">Zone</Label>
        <ToggleGroup type="single" variant="outline" :model-value="zone" aria-labelledby="deck-card-zone" class="flex-wrap justify-start" @update:model-value="(v) => v && (zone = v as Zone)">
          <ToggleGroupItem v-for="z in zones" :key="z" :value="z" :class="ACTIVE" class="px-3">{{ ZONE_LABELS[z] }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex justify-between gap-2">
        <DestructiveButton :disabled="busy" @click="emit('remove')">Remove from deck</DestructiveButton>
        <Button :disabled="busy || !dirty" @click="emit('save', { quantity, zone })">Save</Button>
      </div>
    </template>
  </section>
</template>
