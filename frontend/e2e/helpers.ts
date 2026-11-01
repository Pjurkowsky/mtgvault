import { expect, type APIRequestContext, type Page } from '@playwright/test'

export type TestUser = {
  username: string
  email: string
  password: string
  currency: 'USD' | 'EUR' | 'PLN'
}

const CURRENCY_LABELS = { USD: 'US Dollar (USD)', EUR: 'Euro (EUR)', PLN: 'Polish Złoty (PLN)' }

/** A fresh user per test, so tests run in parallel on one database. */
export function uniqueUser(prefix = 'u'): TestUser {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    username: `${prefix}_${id}`,
    email: `${prefix}_${id}@example.com`,
    password: 'correct-horse-42',
    currency: 'EUR',
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
