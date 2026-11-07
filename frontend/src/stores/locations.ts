import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, type Schemas } from '@/api/client'

export type Location = Schemas['Location']
export type Totals = Schemas['Totals']

/** The user's locations plus Unfiled totals. Shared by pages and dialogs. */
export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<Location[]>([])
  const unfiled = ref<Totals>({ card_count: 0, value: null, values: { USD: null, EUR: null, PLN: null } })
  const cart = ref<Totals>({ card_count: 0, value: null, values: { USD: null, EUR: null, PLN: null } })
  // The want list's tile (spec 010, AC-7).
  const wants = ref<Totals>({ card_count: 0, value: null, values: { USD: null, EUR: null, PLN: null } })
  const currency = ref('USD')
  const loaded = ref(false)

  async function load() {
    const { data } = await api.GET('/api/locations/')
    if (!data) return
    locations.value = data.locations
    unfiled.value = data.unfiled
    cart.value = data.cart
    wants.value = data.wants
    currency.value = data.currency
    loaded.value = true
  }

  async function create(body: Pick<Location, 'name' | 'kind' | 'is_public'> & Partial<Pick<Location, 'deck_format'>>) {
    const { data, error } = await api.POST('/api/locations/', { body: body as Location })
    if (data) await load()
    return { data, error }
  }

  async function update(id: number, body: Partial<Location>) {
    const { data, error } = await api.PATCH('/api/locations/{id}/', { params: { path: { id } }, body })
    if (data) await load()
    return { data, error }
  }

  async function remove(id: number, body: Schemas['LocationDelete']) {
    const { error } = await api.POST('/api/locations/{id}/delete/', { params: { path: { id } }, body })
    if (!error) await load()
    return { error }
  }

  const byId = (id: number | null | undefined) => locations.value.find((l) => l.id === id)

  return { locations, unfiled, cart, wants, currency, loaded, load, create, update, remove, byId }
})
