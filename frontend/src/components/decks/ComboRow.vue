<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon, ExternalLinkIcon, InfinityIcon, PlusIcon, TrophyIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import IconButton from '@/components/IconButton.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** One Commander Spellbook combo: its cards, what it makes, its steps (spec 022, AC-9, AC-10). */
type Combo = Schemas['Combo']
type ComboCard = Schemas['ComboCard']
const props = defineProps<{ combo: Combo; editable: boolean }>()
const emit = defineEmits<{ open: [card: ComboCard]; add: [card: ComboCard] }>()
const stepsOpen = ref(false)
const steps = computed(() => props.combo.description.split('\n').map((s) => s.trim()).filter(Boolean))
</script>

<template>
  <article class="grid gap-3 rounded-lg border p-3" :data-combo="combo.id" data-testid="combo">
    <div class="flex flex-wrap items-start gap-2">
      <Badge v-if="combo.infinite" variant="secondary" data-testid="combo-infinite"><InfinityIcon /> Infinite</Badge>
      <Badge v-if="combo.wins" variant="secondary" data-testid="combo-win"><TrophyIcon /> Win</Badge>
      <p class="line-clamp-2 min-w-0 flex-1 text-sm" :title="combo.produces.join('\n')" data-testid="combo-produces">{{ combo.produces.join(' · ') }}</p>
      <IconButton label="Open on Commander Spellbook" variant="ghost" as="a" :href="combo.url" target="_blank" rel="noopener" class="-my-1" data-testid="combo-link">
        <ExternalLinkIcon />
      </IconButton>
    </div>

    <ul class="flex flex-wrap gap-2">
      <li v-for="card in combo.cards" :key="card.oracle_id" class="grid w-24 content-start gap-1" :data-missing="!card.in_deck || undefined" data-testid="combo-card">
        <button
          type="button" class="rounded-[4.75%/3.5%] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
          :disabled="!card.in_deck && !card.printing" :aria-label="`Open ${card.name}`" @click="emit('open', card)"
        >
          <img :src="card.image" :alt="card.name" :class="['aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted', !card.in_deck && 'opacity-40']" loading="lazy" />
        </button>
        <template v-if="!card.in_deck">
          <Tooltip v-if="card.owned">
            <TooltipTrigger as-child>
              <span class="inline-flex w-fit items-center gap-1.5 text-xs" tabindex="0" data-testid="combo-owned">
                <span class="size-2 shrink-0 rounded-full bg-sky-500" /> In collection
              </span>
            </TooltipTrigger>
            <TooltipContent>You have a copy in your collection</TooltipContent>
          </Tooltip>
          <Button v-if="editable && card.printing" size="sm" variant="outline" class="h-7" :aria-label="`Add ${card.name} to the Maybeboard`" @click="emit('add', card)">
            <PlusIcon /> Add
          </Button>
        </template>
      </li>
    </ul>

    <div class="grid gap-2">
      <button
        type="button" class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground" :aria-expanded="stepsOpen"
        data-testid="combo-steps-toggle" @click="stepsOpen = !stepsOpen"
      >
        <ChevronDownIcon :class="['size-4 transition-transform', stepsOpen && 'rotate-180']" /> Steps
      </button>
      <div v-if="stepsOpen" class="grid gap-2 text-sm" data-testid="combo-steps">
        <p v-if="combo.requires.length"><span class="text-muted-foreground">Also needs:</span> {{ combo.requires.join(', ') }}</p>
        <p v-if="combo.prerequisites" class="whitespace-pre-line"><span class="text-muted-foreground">Before:</span> {{ combo.prerequisites }}</p>
        <ol class="list-decimal space-y-1 pl-5">
          <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
        </ol>
      </div>
    </div>
  </article>
</template>
