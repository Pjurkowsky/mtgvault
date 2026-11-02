import { ref, watch, type Ref } from 'vue'

/** A setting remembered in this browser (view choices, sizes). */
export function usePreference<T extends string>(key: string, fallback: T, allowed?: readonly T[]): Ref<T> {
  let initial = fallback
  try {
    const stored = localStorage.getItem(`mtgvault.${key}`) as T | null
    if (stored && (!allowed || allowed.includes(stored))) initial = stored
  } catch {
    /* storage blocked: use the fallback */
  }
  const value = ref(initial) as Ref<T>
  watch(value, (next) => {
    try {
      localStorage.setItem(`mtgvault.${key}`, next)
    } catch {
      /* ignore */
    }
  })
  return value
}
