<script setup lang="ts">
import { CircleAlertIcon, CircleCheckIcon } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatLabel, type DeckDetail } from '@/lib/decks'

/** Legality with every issue listed (spec 004, AC-22). */
defineProps<{ deck: DeckDetail }>()
</script>

<template>
  <p v-if="deck.format === 'casual'" class="hidden" />
  <p v-else-if="deck.legality.legal" class="flex items-center gap-1.5 text-sm text-emerald-600" data-testid="legality">
    <CircleCheckIcon class="size-4" /> Legal in {{ formatLabel(deck.format) }}
  </p>
  <Alert v-else variant="destructive" data-testid="legality">
    <CircleAlertIcon />
    <AlertTitle>Not legal in {{ formatLabel(deck.format) }}</AlertTitle>
    <AlertDescription>
      <ul class="grid gap-0.5">
        <li v-for="(issue, i) in deck.legality.issues" :key="i" :data-code="issue.code">{{ issue.message }}</li>
      </ul>
    </AlertDescription>
  </Alert>
</template>
