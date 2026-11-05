import { ref } from 'vue'
import { api } from '@/api/client'

/** Category suggestions (spec 006, AC-13), loaded once per page load and refreshed after edits. */
const suggestions = ref<string[]>([])
let loaded = false

export function useCategorySuggestions() {
  if (!loaded) {
    loaded = true
    void refreshSuggestions()
  }
  return suggestions
}

export async function refreshSuggestions() {
  const { data } = await api.GET('/api/decks/categories/')
  if (data) suggestions.value = data.categories
}
