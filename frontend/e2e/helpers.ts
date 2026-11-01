import { readFileSync } from 'node:fs'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export type TestUser = {
  username: string
  email: string
  password: string
  currency: 'USD' | 'EUR' | 'PLN'
}

const CURRENCY_LABELS = { USD: 'US Dollar (USD)', EUR: 'Euro (EUR)', PLN: 'Polish Złoty (PLN)' }

/** A fresh user per test, so tests run in parallel on one database. */
export function uniqueUser(prefix = 'u', currency: TestUser['currency'] = 'EUR'): TestUser {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    username: `${prefix}_${id}`,
    email: `${prefix}_${id}@example.com`,
    password: 'correct-horse-42',
    currency,
  }
}

export async function pickCurrency(page: Page, currency: TestUser['currency']) {
  await page.getByRole('combobox', { name: 'Currency' }).click()
  await page.getByRole('option', { name: CURRENCY_LABELS[currency] }).click()
}

export async function fillSignUp(page: Page, user: TestUser) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await pickCurrency(page, user.currency)
}

/** Sign up through the UI and wait until the app shows the logged-in user. */
export async function signUp(page: Page, user: TestUser) {
  await fillSignUp(page, user)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByTestId('user-menu')).toHaveText(user.username)
}

/**
 * Create a user through the API without logging the page in.
 * Safe to call twice: Playwright runs beforeAll once per worker.
 */
export async function createUser(request: APIRequestContext, user: TestUser) {
  const response = await request.post('/api/auth/register/', { data: user })
  if (response.status() === 201) return
  const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
  expect(login.status(), 'user exists with the expected password').toBe(200)
}

export async function logIn(page: Page, login: string, password: string) {
  await page.getByLabel('Username or email').fill(login)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

export async function logOut(page: Page) {
  await page.getByTestId('user-menu').click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

/** Call the API as a user, for test setup that the UI is not under test for. */
export async function apiAs(request: APIRequestContext, user: TestUser) {
  const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
  expect(login.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await login.json()).access}` }
  const call = async (method: 'get' | 'post' | 'patch' | 'delete', path: string, data?: unknown) => {
    const response = await request[method](path, { headers, data })
    expect(response.ok(), `${method.toUpperCase()} ${path} -> ${response.status()} ${await response.text()}`).toBe(true)
    return response.status() === 204 ? null : response.json()
  }
  return {
    get: (path: string) => call('get', path),
    post: (path: string, data?: unknown) => call('post', path, data),
    patch: (path: string, data: unknown) => call('patch', path, data),
    /** Create a location; returns its id. */
    location: async (name: string, kind = 'binder', isPublic = false) =>
      (await call('post', '/api/locations/', { name, kind, is_public: isPublic })).id as number,
    /** Import a text list into a location (or Unfiled). */
    importList: (text: string, location: number | null = null, extra: Record<string, unknown> = {}) =>
      call('post', '/api/imports/commit/', { text, location, ...extra }),
  }
}

/** Sign up through the API and log the page in through the UI. */
export async function signUpAndLogIn(page: Page, request: APIRequestContext, user = uniqueUser()) {
  await createUser(request, user)
  await page.goto('/login')
  await logIn(page, user.username, user.password)
  await expect(page.getByTestId('user-menu')).toHaveText(user.username)
  return { user, api: await apiAs(request, user) }
}

/** Every paper printing in the card fixture as a text list, one copy each. */
export function fixtureList(): string {
  const file = new URL('../../backend/cards/fixtures/scryfall-sample.jsonl', import.meta.url)
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((c) => !c.digital && !['token', 'double_faced_token', 'emblem', 'art_series'].includes(c.layout))
    .map((c) => {
      const marker = c.finishes.includes('nonfoil') ? '' : c.finishes.includes('foil') ? ' *F*' : ' *E*'
      return `1 ${c.name} (${c.set.toUpperCase()}) ${c.collector_number}${marker}`
    })
    .join('\n')
}

export const tile = (page: Page, name: string) => page.getByTestId('card-tile').filter({ has: page.getByAltText(name, { exact: true }) })
export const locationTile = (page: Page, name: string) => page.getByTestId('location-tile').filter({ hasText: name })

/** Pick an option in a shadcn Select found by its accessible name. */
export async function choose(page: Page, select: string, option: string) {
  await page.getByRole('combobox', { name: select }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
