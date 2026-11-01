import { expect, test, type Page } from '@playwright/test'
import { choose, locationTile, signUpAndLogIn, tile } from './helpers'

async function openAdd(page: Page) {
  await page.getByRole('button', { name: 'Add card' }).click()
  return page.getByRole('dialog')
}

async function pickCard(page: Page, search: string, name: string) {
  await page.getByLabel('Card name').fill(search)
  await page.getByTestId('card-results').getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('printing-picker')).toBeVisible()
}

test.describe('Add a card', () => {
  test('AC-21, AC-22: search needs 2 characters; printings are newest first', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    const dialog = await openAdd(page)
    await page.getByLabel('Card name').fill('b')
    await expect(dialog.getByTestId('card-results')).toHaveCount(0)
    await pickCard(page, 'bolt', 'Lightning Bolt')
    const printings = dialog.getByRole('radio')
    await expect(printings).toHaveCount(8)
    await expect(printings.first()).toHaveAccessibleName('Secret Lair Countdown #83')
    await expect(printings.first()).toHaveAttribute('aria-checked', 'true')
  })

  test('AC-23, AC-24: defaults, and Unfiled from All cards', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAdd(page)
    await pickCard(page, 'sol ring', 'Sol Ring')
    await expect(page.getByLabel('Quantity')).toHaveValue('1')
    await expect(page.getByRole('combobox', { name: 'Finish' })).toHaveText('Nonfoil')
    await expect(page.getByRole('combobox', { name: 'Condition' })).toHaveText('Near Mint')
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveText('English')
    await expect(page.getByRole('combobox', { name: 'Purchase currency' })).toHaveText('EUR')
    await expect(page.getByRole('combobox', { name: 'Location' })).toHaveText('Unfiled')
  })

  test('AC-24: location defaults to the location being viewed', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.location('Red Binder')
    await page.reload()
    await locationTile(page, 'Red Binder').getByRole('link').click()
    await openAdd(page)
    await pickCard(page, 'sol ring', 'Sol Ring')
    await expect(page.getByRole('combobox', { name: 'Location' })).toHaveText('Red Binder')
  })

  test('AC-15: finish options follow the printing', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAdd(page)
    await pickCard(page, 'fire', 'Fire // Ice')
    await page.getByRole('combobox', { name: 'Finish' }).click()
    await expect(page.getByRole('option')).toHaveText(['Nonfoil', 'Foil', 'Etched'])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Back to results' }).click()
    await pickCard(page, 'abstergo', 'Abstergo Entertainment')
    await expect(page.getByRole('combobox', { name: 'Finish' })).toHaveText('Etched')
  })

  test('AC-16, AC-17: condition and language lists', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAdd(page)
    await pickCard(page, 'sol ring', 'Sol Ring')
    await page.getByRole('combobox', { name: 'Condition' }).click()
    await expect(page.getByRole('option')).toHaveText(['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'])
    await page.keyboard.press('Escape')
    await page.getByRole('combobox', { name: 'Language' }).click()
    await expect(page.getByRole('option')).toHaveCount(18)
  })

  test('AC-14, AC-19, AC-20, AC-25: add, stay open, merge identical rows with an averaged price', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    const dialog = await openAdd(page)

    await pickCard(page, 'sol ring', 'Sol Ring')
    await page.getByLabel('Quantity').fill('2')
    await page.getByLabel('Purchase price').fill('1.00')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 2 × Sol Ring.')).toBeVisible()
    // AC-25: still open, search cleared
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('Card name')).toHaveValue('')

    await pickCard(page, 'sol ring', 'Sol Ring')
    await page.getByLabel('Quantity').fill('2')
    await page.getByLabel('Purchase price').fill('3.00')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 2 × Sol Ring (merged with an existing row).')).toBeVisible()

    // AC-20: 2 copies at 10 USD = 9.09 EUR each → (4 × 2.00 + 2 × 9.09) / 6 = 4.36 EUR
    await pickCard(page, 'sol ring', 'Sol Ring')
    await page.getByLabel('Quantity').fill('2')
    await page.getByLabel('Purchase price').fill('10')
    await choose(page, 'Purchase currency', 'USD')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText(/Added 2 × Sol Ring \(merged/)).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(tile(page, 'Sol Ring')).toHaveCount(1)
    await expect(tile(page, 'Sol Ring').getByTestId('card-quantity')).toHaveText('×6')
    await tile(page, 'Sol Ring').click()
    await expect(page.getByTestId('detail-purchase-price')).toHaveText('€4.36')
    await expect(page.getByTestId('detail-added-price')).toHaveText('€0.91')
  })
})
