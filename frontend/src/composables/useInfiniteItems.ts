import { ref, shallowRef, watch, type Ref } from 'vue'

export type Page<T> = {
  currency: string
  prices_updated_at?: string | null
  count: number
  total_quantity: number
  total_value?: number | null
  results: T[]
}

export const PAGE_SIZE = 60

/** Loads pages of rows; restarts whenever `key` changes (spec 001, AC-35). */
export function useInfiniteItems<T>(fetchPage: (offset: number, limit: number) => Promise<Page<T> | undefined>, key: Ref<unknown>) {
  const rows = shallowRef<T[]>([])
  const page = ref<Omit<Page<T>, 'results'> | null>(null)
  const loading = ref(false)
  const done = ref(false)
  let generation = 0

  async function loadMore() {
    if (loading.value || done.value) return
    loading.value = true
    const mine = generation
    const data = await fetchPage(rows.value.length, PAGE_SIZE)
    if (mine !== generation) return // a newer reload started meanwhile
    loading.value = false
    if (!data) return
    const { results, ...meta } = data
    page.value = meta
    rows.value = [...rows.value, ...results]
    done.value = rows.value.length >= data.count || results.length === 0
  }

  function reload() {
    generation++
    rows.value = []
    done.value = false
    loading.value = false
    return loadMore()
  }

  watch(key, reload, { deep: true, immediate: true })

  return { rows, page, loading, done, loadMore, reload }
}
