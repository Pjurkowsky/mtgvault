<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckIcon, ChevronsUpDownIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CONDITIONS, FINISHES, LANGUAGES, type Condition, type Finish, type Language } from '@/lib/cards'
import { CURRENCIES, type Currency } from '@/lib/currency'
import { cn } from '@/lib/utils'
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

/** Up to this many locations show as toggle buttons; more get a searchable list (AC-11). */
const MAX_LOCATION_TOGGLES = 6
// The chosen toggle stands out clearly.
const ACTIVE = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

const props = defineProps<{ finishes: string[]; errors?: Record<string, string> }>()
const form = defineModel<ItemForm>({ required: true })
const locations = useLocationsStore()

const finishOptions = computed(() => FINISHES.filter((f) => props.finishes.includes(f.value)))
const locationOptions = computed(() => [
  { value: 'unfiled', label: 'Unfiled' },
  ...locations.locations.map((l) => ({ value: String(l.id), label: l.name })),
])
const asToggles = computed(() => locations.locations.length <= MAX_LOCATION_TOGGLES)
const locationLabel = computed(() => locationOptions.value.find((o) => o.value === form.value.location)?.label ?? 'Unfiled')
const pickerOpen = ref(false)

// Toggle groups allow clicking the active item off; keep a value instead.
const setFinish = (v: unknown) => v && (form.value.finish = v as Finish)
const setLocation = (v: unknown) => v && (form.value.location = String(v))
</script>

<!-- Row fields shared by Add card and Edit (spec 001 AC-23, spec 002 AC-10, AC-11). -->
<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <Label id="item-finish-label">Finish</Label>
      <ToggleGroup type="single" variant="outline" :model-value="form.finish" aria-labelledby="item-finish-label" class="justify-start" @update:model-value="setFinish">
        <ToggleGroupItem v-for="f in finishOptions" :key="f.value" :value="f.value" :class="ACTIVE" class="px-4">{{ f.label }}</ToggleGroupItem>
      </ToggleGroup>
      <p v-if="errors?.finish" class="text-sm text-destructive">{{ errors.finish }}</p>
    </div>

    <div class="grid gap-2">
      <Label id="item-location-label">Location</Label>
      <ToggleGroup
        v-if="asToggles" type="single" variant="outline" :model-value="form.location"
        aria-labelledby="item-location-label" class="flex-wrap justify-start" @update:model-value="setLocation"
      >
        <ToggleGroupItem v-for="o in locationOptions" :key="o.value" :value="o.value" :class="ACTIVE" class="px-3">{{ o.label }}</ToggleGroupItem>
      </ToggleGroup>
      <Popover v-else v-model:open="pickerOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" role="combobox" aria-labelledby="item-location-label" class="w-full justify-between font-normal sm:w-72">
            {{ locationLabel }} <ChevronsUpDownIcon class="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search locations" />
            <CommandList>
              <CommandEmpty>No location found.</CommandEmpty>
              <CommandItem
                v-for="o in locationOptions" :key="o.value" :value="o.label"
                @select="() => { form.location = o.value; pickerOpen = false }"
              >
                <CheckIcon :class="cn('size-4', form.location === o.value ? 'opacity-100' : 'opacity-0')" />
                {{ o.label }}
              </CommandItem>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="grid gap-2">
        <Label for="item-quantity">Quantity</Label>
        <Input id="item-quantity" v-model.number="form.quantity" type="number" min="1" max="999" />
        <p v-if="errors?.quantity" class="text-sm text-destructive">{{ errors.quantity }}</p>
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
    </div>
  </div>
</template>
