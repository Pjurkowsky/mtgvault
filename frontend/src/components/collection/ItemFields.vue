<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CONDITIONS, FINISHES, LANGUAGES, type Condition, type Finish, type Language } from '@/lib/cards'
import { CURRENCIES, type Currency } from '@/lib/currency'
import { useLocationsStore } from '@/stores/locations'

export type ItemForm = {
  quantity: number
  finish: Finish
  condition: Condition
  language: Language
  purchase_price: string
  purchase_currency: Currency
  location: string // location id, or 'unfiled'
}

const props = defineProps<{ finishes: string[]; errors?: Record<string, string> }>()
const form = defineModel<ItemForm>({ required: true })
const locations = useLocationsStore()

const finishOptions = computed(() => FINISHES.filter((f) => props.finishes.includes(f.value)))
</script>

<!-- Row fields shared by Add card and the card detail (AC-23, AC-27). -->
<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
    <div class="grid gap-2">
      <Label for="item-quantity">Quantity</Label>
      <Input id="item-quantity" v-model.number="form.quantity" type="number" min="1" max="999" />
      <p v-if="errors?.quantity" class="text-sm text-destructive">{{ errors.quantity }}</p>
    </div>
    <div class="grid gap-2">
      <Label for="item-finish">Finish</Label>
      <Select v-model="form.finish">
        <SelectTrigger id="item-finish" class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="f in finishOptions" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
        </SelectContent>
      </Select>
      <p v-if="errors?.finish" class="text-sm text-destructive">{{ errors.finish }}</p>
    </div>
    <div class="grid gap-2">
      <Label for="item-condition">Condition</Label>
      <Select v-model="form.condition">
        <SelectTrigger id="item-condition" class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="grid gap-2">
      <Label for="item-language">Language</Label>
      <Select v-model="form.language">
        <SelectTrigger id="item-language" class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="grid gap-2">
      <Label for="item-price">Purchase price</Label>
      <div class="flex gap-1">
        <Input id="item-price" v-model="form.purchase_price" type="number" min="0" step="0.01" class="min-w-0" />
        <Select v-model="form.purchase_currency">
          <SelectTrigger class="w-20" aria-label="Purchase currency"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.value }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p v-if="errors?.purchase_price" class="text-sm text-destructive">{{ errors.purchase_price }}</p>
    </div>
    <div class="grid gap-2">
      <Label for="item-location">Location</Label>
      <Select v-model="form.location">
        <SelectTrigger id="item-location" class="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unfiled">Unfiled</SelectItem>
          <SelectItem v-for="l in locations.locations" :key="l.id" :value="String(l.id)">{{ l.name }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
