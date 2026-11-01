import { computed, ref } from 'vue'
import type { BrowserFilter } from './useBrowserQuery'

export type Selection = { ids: number[] } | { filter: Record<string, unknown>; exclude_ids: number[] }

/**
 * Picked rows, or "every row matching a filter" minus exclusions.
 * Select all freezes the filter that was active, so later search or filter
 * changes keep the selection (spec 001, AC-39, AC-40).
 */
export function useSelection() {
  const active = ref(false)
  const all = ref<{ filter: Record<string, unknown>; count: number } | null>(null)
  const ids = ref(new Set<number>())
  const excluded = ref(new Set<number>())

  const count = computed(() => (all.value ? all.value.count - excluded.value.size : ids.value.size))

  const isSelected = (id: number) => (all.value ? !excluded.value.has(id) : ids.value.has(id))

  function set(id: number, selected: boolean) {
    const target = all.value ? excluded.value : ids.value
    const add = all.value ? !selected : selected
    const next = new Set(target)
    if (add) next.add(id)
    else next.delete(id)
    if (all.value) excluded.value = next
    else ids.value = next
  }

  const toggle = (id: number) => set(id, !isSelected(id))

  function selectAll(filter: BrowserFilter & { location?: string }, total: number) {
    all.value = { filter: { ...filter }, count: total }
    excluded.value = new Set()
    ids.value = new Set()
  }

  function clear() {
    all.value = null
    ids.value = new Set()
    excluded.value = new Set()
  }

  function stop() {
    clear()
    active.value = false
  }

  const toSelection = (): Selection =>
    all.value ? { filter: all.value.filter, exclude_ids: [...excluded.value] } : { ids: [...ids.value] }

  return { active, count, isSelected, set, toggle, selectAll, clear, stop, toSelection }
}
