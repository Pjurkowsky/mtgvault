import { computed, ref, watch } from 'vue'
import { usePreference } from '@/composables/usePreference'

/** Light, dark or the device's choice, saved in this browser (spec 022, AC-16). */
export type Theme = 'light' | 'dark' | 'system'
export const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// index.html applies the same rule before the app loads, so there is no light flash.
export const theme = usePreference<Theme>('theme', 'system', ['light', 'dark', 'system'])

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(query?.matches ?? false)
query?.addEventListener('change', (e) => (systemDark.value = e.matches))

export const isDark = computed(() => theme.value === 'dark' || (theme.value === 'system' && systemDark.value))

watch(isDark, (dark) => {
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}, { immediate: true })
