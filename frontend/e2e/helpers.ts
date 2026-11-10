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
  const call = async (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: unknown) => {
    const response = await request[method](path, { headers, data })
    expect(response.ok(), `${method.toUpperCase()} ${path} -> ${response.status()} ${await response.text()}`).toBe(true)
    return response.status() === 204 ? null : response.json()
  }
  return {
    get: (path: string) => call('get', path),
    post: (path: string, data?: unknown) => call('post', path, data),
    put: (path: string, data: unknown) => call('put', path, data),
    patch: (path: string, data: unknown) => call('patch', path, data),
    delete: (path: string) => call('delete', path),
    /** Create a location; returns its id. */
    location: async (name: string, kind = 'binder', isPublic = false) =>
      (await call('post', '/api/locations/', { name, kind, is_public: isPublic })).id as number,
    /** Create a deck (spec 004); returns the deck detail. */
    deck: (name: string, format = 'casual', extra: Record<string, unknown> = {}) =>
      call('post', '/api/decks/', { name, format, is_public: false, create_box: false, text: '', ...extra }),
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

/** Open the browser's More (⋯) menu and pick an item (spec 002, AC-19). */
export async function more(page: Page, item: 'Import' | 'Export' | 'Binder settings' | 'Edit location' | 'Delete') {
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Tick a card's checkbox (spec 002, AC-12). */
export async function check(page: Page, name: string) {
  await page.getByRole('checkbox', { name: `Select ${name}` }).first().click()
}

/** Clear all filters from the filter menu (spec 002, AC-21). */
export async function clearFilters(page: Page) {
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Clear' }).click()
  await page.keyboard.press('Escape')
}

/** The pressed button in a labelled toggle group. */
export const pressed = (page: Page, group: string) =>
  page.getByRole('group', { name: group }).getByRole('button', { pressed: true })

/** Select every matching row: tick a card if nothing is selected, then Select all in the bulk bar (spec 002, AC-14). */
export async function selectAll(page: Page) {
  if (!(await page.getByTestId('selection-bar').count())) await page.getByTestId('card-checkbox').first().click()
  await page.getByTestId('selection-bar').getByTestId('select-all').click()
}

/** A row in a deck's list (spec 004, AC-18). */
export const deckRow = (page: Page, name: string) => page.getByTestId('deck-row').filter({ hasText: name })
/** The collection's card dialog, opened from a deck card with its deck section (spec 005, AC-3). */
export const cardDialog = (page: Page) => page.getByTestId('card-detail')
/** Close the card dialog with its button (Escape may only close a tooltip under the pointer). */
export async function closeCardDialog(page: Page) {
  await cardDialog(page).getByRole('button', { name: 'Close' }).last().click()
  await cardDialog(page).waitFor({ state: 'hidden' })
}

/** Open the deck page's More (⋯) menu and pick an item. */
export async function deckMenu(page: Page, item: 'Import' | 'Export' | 'Edit' | 'Create deck box' | 'Delete') {
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Open the Unplaced sidebar; it starts closed (spec 009, AC-7). */
export async function showUnplaced(page: Page) {
  await page.getByRole('button', { name: 'Show Unplaced' }).click()
  await expect(page.getByTestId('unplaced-sidebar')).toHaveAttribute('data-state', 'open')
  // A trial click waits until the slide-in has stopped, so positions are final.
  await page.getByTestId('unplaced-tray').click({ trial: true, position: { x: 4, y: 4 } })
}

/** A binder pocket by page and slot number (spec 007); slots count left to right, top to bottom. */
export const binderSlot = (page: Page, p: number, n: number, cols = 3) =>
  page.locator(`[data-testid="binder-slot"][data-place="${p}-${Math.floor((n - 1) / cols) + 1}-${((n - 1) % cols) + 1}"]`)
