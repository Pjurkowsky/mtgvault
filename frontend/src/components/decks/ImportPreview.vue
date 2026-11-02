<script setup lang="ts">
import { CircleAlertIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ZONE_LABELS, type Zone } from '@/lib/decks'

/** A parsed decklist by zone, with lines that didn't match (spec 004, AC-25). */
const props = defineProps<{ preview: Schemas['DeckImportPreview'] }>()
const ZONES: Zone[] = ['commander', 'main', 'side', 'maybe']
const zoneRows = (zone: Zone) => props.preview.rows.filter((r) => r.zone === zone)
</script>

<template>
  <Alert v-if="preview.errors.length" variant="destructive" class="bg-destructive/10" data-testid="deck-import-errors">
    <CircleAlertIcon />
    <AlertDescription>
      <ul><li v-for="e in preview.errors" :key="e.line">Line {{ e.line }}: {{ e.text }} · {{ e.reason }}</li></ul>
    </AlertDescription>
  </Alert>
  <template v-for="zone in ZONES" :key="zone">
    <div v-if="zoneRows(zone).length">
      <p class="text-sm font-medium">{{ ZONE_LABELS[zone] }} ({{ zoneRows(zone).reduce((n, r) => n + r.quantity, 0) }})</p>
      <ul class="text-sm text-muted-foreground" :data-testid="`deck-import-${zone}`">
        <li v-for="r in zoneRows(zone)" :key="r.line">{{ r.quantity }} {{ r.printing.name }}</li>
      </ul>
    </div>
  </template>
</template>
