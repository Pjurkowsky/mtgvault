import { expect, test, type Page } from '@playwright/test'
import { apiAs, createUser, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 003 with the real recognition models and a fake camera showing Sol Ring (C21).
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000

async function openScanner(page: Page) {
  await page.goto('/cards')
  await page.getByRole('button', { name: 'Scan cards' }).click()
  await expect(page.getByTestId('scanner')).toBeVisible()
}

/** Count Web Audio tones the scanner plays (AC-13). */
async function countTones(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: number }
    w.__tones = 0
    const original = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__tones += 1
      return original.call(this)
    }
  })
}

test('AC-1, AC-3, AC-5, AC-7, AC-10, AC-14, AC-17: opens from the toolbar and logs a held card into the cart', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await openScanner(page)
  await expect(page).toHaveURL(/\/scan\/fast$/) // Fast scanning is on for new accounts (spec 019, AC-11)
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect(page.getByTestId('scan-status')).toHaveText('Added Sol Ring')
  await expect(page.getByTestId('result-name')).toHaveText('Sol Ring')
  await expect(page.getByTestId('running-total')).toContainText('1 card')

  const cart = await api.get('/api/items/?location=cart')
  expect(cart.count).toBe(1)
  const row = cart.results[0]
  expect([row.printing.name, row.condition, row.language, row.finish, row.in_cart]).toEqual(['Sol Ring', 'NM', 'en', 'nonfoil', true])
  expect((await api.get('/api/items/')).count).toBe(0) // not in the collection (AC-18)
})

test('AC-6, AC-11: no double logging; +1 and Undo', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await openScanner(page)
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await page.waitForTimeout(3000) // the card stays in view
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')

  await page.getByTestId('result-bar').getByRole('button', { name: '1' }).click()
  await expect(page.getByTestId('result-quantity')).toHaveText('×2')
  await expect(page.getByTestId('running-total')).toContainText('2 cards')

  await page.getByTestId('result-bar').getByRole('button', { name: 'Change printing' }).click()
  await expect(page.getByTestId('edit-dialog')).toBeVisible()
  await expect(page.getByTestId('edit-dialog').getByRole('group', { name: 'Location' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByTestId('result-bar').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')
  await page.getByTestId('result-bar').getByRole('button', { name: 'Undo' }).click()
  // Undo removed the last copy, so the still-held card is logged again.
  await expect.poll(async () => (await api.get('/api/items/?location=cart')).total_quantity, { timeout: LOG_TIMEOUT }).toBe(1)
})

test('AC-8: with locked sets, a card from another set is not logged', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await api.patch('/api/scanner/settings/', { locked_sets: ['mh2'] })
  await openScanner(page)
  await expect(page.getByTestId('scan-status')).toHaveText('Not in locked sets: Sol Ring', { timeout: LOG_TIMEOUT })
  await page.waitForTimeout(2000)
  await expect(page.getByTestId('result-bar')).toHaveCount(0)
  expect((await api.get('/api/items/?location=cart')).count).toBe(0)
})

test('AC-13: sounds play for a logged card, and not when turned off', async ({ page, request }) => {
  await countTones(page)
  const { api } = await signUpAndLogIn(page, request)
  await openScanner(page)
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  expect(await page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBeGreaterThan(0)

  await api.patch('/api/scanner/settings/', { sounds: false })
  await page.getByTestId('result-bar').getByRole('button', { name: 'Undo' }).click()
  await page.reload()
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  expect(await page.evaluate(() => (window as unknown as { __tones: number }).__tones)).toBe(0)
})

test('AC-2: a blocked camera explains what to do', async ({ page, request }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
  })
  await signUpAndLogIn(page, request)
  await openScanner(page)
  await expect(page.getByTestId('scanner-error')).toContainText('Camera access is blocked', { timeout: LOG_TIMEOUT })
})

test('AC-16, AC-24: Fast scanning opens the isolated page with several threads; the model is cached', async ({ page, request }) => {
  const user = uniqueUser('fast')
  await createUser(request, user)
  await (await apiAs(request, user)).patch('/api/scanner/settings/', { fast: true })
  await page.goto('/login')
  await page.getByLabel('Username or email').fill(user.username)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByTestId('user-menu')).toHaveText(user.username)
  await openScanner(page)
  await expect(page).toHaveURL(/\/scan\/fast$/)
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await page.getByRole('button', { name: 'Scanner settings' }).click()
  await expect(page.getByTestId('threads-info')).toHaveText(/Recognition uses ([2-9]|\d{2,}) threads/)

  const caches = await page.evaluate(async () => (await window.caches.keys()).filter((k) => k.startsWith('mtgvault-scanner-')))
  expect(caches).toHaveLength(1)
})
