import { expect, test, type Page } from '@playwright/test'
import { fakeCamera, UNSURE_FEED } from '../playwright.config'
import { signUpAndLogIn } from './helpers'

// Spec 019 with the real models and a fake camera showing Sol Ring out of focus: the best
// match stays at 0.56-0.58, so nothing logs by itself and guesses are offered.
test.use({ launchOptions: { args: fakeCamera(UNSURE_FEED) } })
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000
const SOL_RING_C21 = '4cbc6901-6a4a-4d0a-83ea-7eefa3b35021'

const strip = (page: Page) => page.getByTestId('guesses')

test('AC-6 to AC-8: an unsure card offers 3 guesses; X closes them; a tap logs the guess', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await api.patch('/api/scanner/settings/', { suggest_guesses: true })
  await page.goto('/scan')
  await expect(strip(page)).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect(strip(page).getByTestId('guess')).toHaveCount(3)
  await expect(page.getByTestId('scan-status')).toHaveText(/Hold steady/) // scanning keeps running

  await strip(page).getByRole('button', { name: 'Close guesses' }).click()
  await expect(strip(page)).toHaveCount(0)
  await page.waitForTimeout(3000)
  await expect(strip(page)).toHaveCount(0) // not again for the same still card

  // The guesses are cards outside the test catalog: the request keeps the tapped guess, and
  // the test swaps in Sol Ring (C21) on the way so the catalog can log it.
  let sent: { gallery_id: string } | null = null
  await page.route('**/api/scanner/scans/', async (route) => {
    sent = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...sent, gallery_id: SOL_RING_C21, illustration_id: null }) })
  })
  await page.reload()
  await expect(strip(page)).toBeVisible({ timeout: LOG_TIMEOUT })
  const second = strip(page).getByTestId('guess').nth(1)
  const name = (await second.getAttribute('aria-label'))!
  await second.click()
  await expect(strip(page)).toHaveCount(0)
  await expect.poll(() => sent?.gallery_id).toBeTruthy()
  expect(name).toMatch(/\(\w+\)$/)
  await expect(page.getByTestId('result-name')).toHaveText('Sol Ring')
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')
  await page.waitForTimeout(3000)
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')
  await expect(strip(page)).toHaveCount(0)
  expect((await api.get('/api/locations/')).cart.card_count).toBe(1)
})

test('AC-6: guesses outside locked sets are left out', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  // Lightning Bolt's set: none of the out-of-focus card's guesses come from it.
  await api.patch('/api/scanner/settings/', { suggest_guesses: true, locked_sets: ['fdc'] })
  await page.goto('/scan')
  await expect(page.getByTestId('scan-status')).toHaveText(/Hold steady/, { timeout: LOG_TIMEOUT })
  await page.waitForTimeout(4000) // well past the 1.5 s an unlocked scanner needs
  await expect(strip(page)).toHaveCount(0)
})
