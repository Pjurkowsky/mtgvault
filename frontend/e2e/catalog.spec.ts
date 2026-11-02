import { expect, test } from '@playwright/test'
import { pickCurrency, signUpAndLogIn, tile, uniqueUser } from './helpers'

// Prices come from the card fixture with fixed rates: 1 EUR = 4.40 PLN, 1 USD = 4.00 PLN.
test.describe('Catalog and prices', () => {
  test('AC-1, AC-2, AC-4: prices come from the catalog in the user\'s currency', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request, uniqueUser('usd', 'USD'))
    await api.importList('1 Sol Ring (C21) 263\n1 Delver of Secrets (ISD) 51 *F*')
    await page.goto('/cards')
    await expect(tile(page, 'Sol Ring').getByTestId('price')).toHaveText('$1.84')
    await expect(tile(page, 'Delver of Secrets // Insectile Aberration').getByTestId('price')).toHaveText('$2.11')

    await page.goto('/settings')
    await pickCurrency(page, 'EUR')
    await page.goto('/cards')
    await expect(tile(page, 'Sol Ring').getByTestId('price')).toHaveText('€0.91')
  })

  test('AC-3: PLN is EUR at the NBP rate', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request, uniqueUser('pln', 'PLN'))
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    // 0.91 EUR × 4.40 = 4.004 PLN
    await expect(tile(page, 'Sol Ring').getByTestId('price')).toHaveText('PLN 4.00')
    await page.getByTestId('browser-summary').getByTestId('price').hover()
    const tip = page.getByTestId('price-tooltip').first()
    await expect(tip).toContainText('$1.84')
    await expect(tip).toContainText('€0.91')
    await expect(tip).not.toContainText('estimate')
  })

  test('AC-5: a missing price shows "–" and counts as 0', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request, uniqueUser('miss', 'EUR'))
    // Fire // Ice has no EUR etched price; Sol Ring is €0.91.
    await api.importList('1 Fire // Ice (MH2) 290 *E*\n1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await expect(tile(page, 'Fire // Ice').getByTestId('price')).toHaveText('–')
    await expect(page.getByTestId('browser-summary')).toContainText('€0.91')
  })

  test('AC-6: the browser shows when prices were last updated', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await expect(page.getByTestId('prices-updated')).toContainText(/Prices updated \w+ \d+, \d{4}/)
  })
})
