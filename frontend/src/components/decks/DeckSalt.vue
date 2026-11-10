<script setup lang="ts">
import { computed } from 'vue'
import type { Schemas } from '@/api/client'
import InfoTip from '@/components/InfoTip.vue'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Deck salt against the average deck, saltiest cards on hover (spec 022, AC-12). */
const props = defineProps<{ salt: Schemas['DeckSalt'] }>()
const scale = computed(() => props.salt.average * 2)
const fill = computed(() => `${Math.min(100, (props.salt.total / scale.value) * 100)}%`)
</script>

<template>
  <Card class="gap-3 p-4" data-testid="salt-card">
    <h3 class="flex items-center gap-2 text-sm font-semibold">
      Salt <InfoTip :text="`How much players dislike facing these cards, from EDHREC's community scores (0 to 4 per card). The average deck sums to ${salt.average}.`" />
    </h3>
    <Tooltip>
      <TooltipTrigger as-child>
        <div class="grid gap-2" tabindex="0" data-testid="salt-meter">
          <p class="text-xl font-semibold tabular-nums" data-testid="salt-total">{{ salt.total.toFixed(1) }}</p>
          <div class="relative h-2 rounded-full bg-muted">
            <div class="h-full rounded-full bg-series-2" :style="{ width: fill }" data-testid="salt-fill" />
            <div class="absolute inset-y-[-3px] left-1/2 w-0.5 rounded bg-foreground/60" data-testid="salt-average" />
          </div>
          <div class="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>0</span><span>Average {{ salt.average }}</span><span>{{ scale }}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent class="grid gap-0.5 text-xs" data-testid="salt-top">
        <template v-if="salt.top.length">
          <span v-for="card in salt.top" :key="card.name" class="flex justify-between gap-4">
            <span>{{ card.name }}</span><span class="tabular-nums">{{ card.salt.toFixed(2) }}</span>
          </span>
        </template>
        <span v-else>No salty cards.</span>
      </TooltipContent>
    </Tooltip>
  </Card>
</template>
