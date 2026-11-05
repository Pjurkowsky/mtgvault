import { computed } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

export type View = 'grid' | 'table' | 'binder'
const LIST_KEYS = ['color', 'type', 'rarity', 'set', 'finish', 'condition'] as const
type ListKey = (typeof LIST_KEYS)[number]
const VIEW_STORAGE = 'mtgvault.browser.view'

export type BrowserFilter = {
  q?: string
  color?: string[]
  type?: string[]
  rarity?: string[]
  set?: string[]
  finish?: string[]
  condition?: string[]
  price_min?: string
  price_max?: string
  sort: string
  dir: 'asc' | 'desc'
}

const list = (v: LocationQueryValue | LocationQueryValue[] | undefined): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => !!x)
const one = (v: LocationQueryValue | LocationQueryValue[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_STORAGE) === 'table' ? 'table' : 'grid'
  } catch {
    return 'grid'
  }
}

/** Search, filters, sort and view live in the URL (spec 001, AC-34). */
export function useBrowserQuery() {
  const route = useRoute()
  const router = useRouter()

  const filter = computed<BrowserFilter>(() => {
    const q = route.query
    const result: BrowserFilter = {
      sort: one(q.sort) || 'name',
      dir: one(q.dir) === 'desc' ? 'desc' : 'asc',
    }
    if (one(q.q)) result.q = one(q.q)!
    for (const key of LIST_KEYS) {
      const values = list(q[key])
      if (values.length) result[key as ListKey] = values
    }
    if (one(q.price_min)) result.price_min = one(q.price_min)!
    if (one(q.price_max)) result.price_max = one(q.price_max)!
    return result
  })

  const view = computed<View>(() => (one(route.query.view) as View) || storedView())

  /** Change the URL. `undefined` or empty values remove the key. */
  function update(patch: Record<string, string | string[] | undefined>) {
    const query = { ...route.query, ...patch }
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete query[key]
    }
    router.replace({ query })
  }

  function setView(next: View) {
    try {
      localStorage.setItem(VIEW_STORAGE, next)
    } catch {
      /* private mode: the URL still carries it */
    }
    update({ view: next })
  }

  function clearFilters() {
    const cleared: Record<string, undefined> = { q: undefined, price_min: undefined, price_max: undefined }
    for (const key of LIST_KEYS) cleared[key] = undefined
    update(cleared)
  }

  const activeFilterCount = computed(() => {
    const f = filter.value
    return LIST_KEYS.reduce((n, k) => n + (f[k]?.length ?? 0), 0) + (f.price_min ? 1 : 0) + (f.price_max ? 1 : 0)
  })

  return { filter, view, update, setView, clearFilters, activeFilterCount }
}
