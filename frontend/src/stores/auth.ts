import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, refreshAccessToken, setAccessToken, type Schemas } from '@/api/client'
import type { Currency } from '@/lib/currency'

type Me = Schemas['Me']

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Me | null>(null)
  const isLoggedIn = computed(() => user.value !== null)

  let initPromise: Promise<void> | null = null

  /** Restore the session from the refresh cookie. Runs once per page load. */
  function init(): Promise<void> {
    initPromise ??= (async () => {
      if (await refreshAccessToken()) await loadMe()
    })()
    return initPromise
  }

  async function loadMe() {
    const { data } = await api.GET('/api/me/')
    user.value = data ?? null
  }

  function startSession(response: Schemas['AuthResponse']) {
    setAccessToken(response.access)
    user.value = response.user
  }

  function clear() {
    setAccessToken(null)
    user.value = null
  }

  async function register(body: Schemas['Register']) {
    const { data, error } = await api.POST('/api/auth/register/', { body })
    if (data) startSession(data)
    return { error }
  }

  async function login(body: Schemas['Login']) {
    const { data, error } = await api.POST('/api/auth/login/', { body })
    if (data) startSession(data)
    return { error }
  }

  async function logout() {
    await api.POST('/api/auth/logout/').catch(() => {})
    clear()
  }

  async function updateCurrency(currency: Currency) {
    const { data, error } = await api.PATCH('/api/me/', { body: { currency } })
    if (data) user.value = data
    return { error }
  }

  async function changePassword(body: Schemas['PasswordChange']) {
    const { error } = await api.POST('/api/me/password/', { body })
    return { error }
  }

  return { user, isLoggedIn, init, clear, register, login, logout, updateCurrency, changePassword }
})
