import { expect, test } from '@playwright/test'
import { selectAll, signUpAndLogIn, tile } from './helpers'

// Spec 002 AC-1 to AC-6. Fixed rates: 1 EUR = 4.40 PLN, 1 USD = 4.00 PLN.
test.describe('Prices, toasts, deletes, tooltips', () => {
  test('AC-1, AC-2: price in your currency, only the others in its tooltip', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').hover()
    const price = tile(page, 'Sol Ring').getByTestId('price')
    await expect(price).toHaveText('€0.91')
    await price.hover()
    const tip = page.getByTestId('price-tooltip').first()
    await expect(tip).toContainText('$1.84')
    await expect(tip).toContainText('PLN 4.00')
    await expect(tip).not.toContainText('estimate')
    await expect(page.locator('body')).not.toContainText('≈')
  })

  test('AC-3: a missing price is "–", and so are missing ones in the tooltip', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Fire // Ice (MH2) 290 *E*')
    await page.goto('/cards')
    await tile(page, 'Fire // Ice').hover()
    const price = tile(page, 'Fire // Ice').getByTestId('price')
    await expect(price).toHaveText('–')
    await price.hover()
    await expect(page.getByTestId('price-tooltip').first()).toContainText('$0.56')
    await expect(page.getByTestId('price-tooltip').first()).toContainText('–')
  })

  test('AC-4: success toasts are green, errors red', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await selectAll(page)
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Edit' }).click()
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Apply' }).click()
    const error = page.locator('[data-sonner-toast][data-type="error"]')
    await expect(error).toContainText('Choose what to change.')
    await expect(error).toHaveAttribute('data-rich-colors', 'true')
    await page.keyboard.press('Escape')

    await page.goto('/settings')
    await page.getByRole('combobox', { name: 'Currency' }).click()
    await page.getByRole('option', { name: 'US Dollar (USD)' }).click()
    const success = page.locator('[data-sonner-toast][data-type="success"]')
    await expect(success).toContainText('Currency changed to USD.')
    await expect(success).toHaveAttribute('data-rich-colors', 'true')
  })

  test('AC-5: deleting a card asks in a dialog naming the card and count', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('2 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toContainText('Delete Sol Ring?')
    await expect(dialog).toContainText('This removes 2 cards from your collection.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(tile(page, 'Sol Ring')).toHaveCount(1)

    await tile(page, 'Sol Ring').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(tile(page, 'Sol Ring')).toHaveCount(0)
  })

  test('AC-6: icon-only buttons have tooltips', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    for (const name of ['More', 'Ascending', 'Grid view', 'Table view']) {
      await page.getByRole('button', { name, exact: true }).hover()
      await expect(page.getByRole('tooltip').filter({ hasText: name })).toBeVisible()
      await page.mouse.move(0, 0)
    }
  })
})
