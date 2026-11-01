import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type Schemas = components['schemas']

// The access token lives only in memory. The refresh token is an httpOnly
// cookie the browser sends to /api/auth/ on its own.
let accessToken: string | null = null
let onAuthLost: () => void = () => {}

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Called when a request gets 401 and the session can't be refreshed. */
export function onAuthenticationLost(callback: () => void) {
  onAuthLost = callback
}

// Parallel 401s share one refresh call. Otherwise the second call would send
// a refresh token the first one already rotated, and get logged out.
let refreshing: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= api
    .POST('/api/auth/refresh/')
    .then(({ data }) => data?.access ?? null)
    .catch(() => null)
    .then((token) => {
      accessToken = token
      return token
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

function withToken(request: Request): Request {
  if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`)
  return request
}

async function authFetch(request: Request): Promise<Response> {
  const isAuthCall = new URL(request.url).pathname.startsWith('/api/auth/')
  const retry = request.clone()
  const response = await fetch(withToken(request))
  if (response.status !== 401 || isAuthCall) return response

  const token = await refreshAccessToken()
  if (!token) {
    onAuthLost()
    return response
  }
  return fetch(withToken(retry))
}

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  fetch: authFetch,
})

/**
 * Turn a DRF error body ({field: [messages]} or {detail}) into one message
 * per field. Non-field errors end up under "form".
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== 'object') return { form: 'Something went wrong. Try again.' }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(error)) {
    // One line per message, so each failed password rule shows separately.
    const message = Array.isArray(value) ? value.join('\n') : String(value)
    const field = key === 'detail' || key === 'non_field_errors' ? 'form' : key
    result[field] = message
  }
  return result
}
