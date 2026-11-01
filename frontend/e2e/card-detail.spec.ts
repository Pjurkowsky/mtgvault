import { expect, test } from '@playwright/test'
import { signUpAndLogIn, tile } from './helpers'

test.describe('Card detail', () => {
  test('AC-26: detail shows image, printing, fields and prices', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('2 Sol Ring (C21) 263', null, { condition: 'LP', purchase_price: 1.5, purchase_currency: 'EUR' })
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    const detail = page.getByTestId('card-detail')
    await expect(detail.getByRole('heading', { name: 'Sol Ring' })).toBeVisible()
    await expect(detail).toContainText('Commander 2021 #263')
    await expect(detail.getByRole('img', { name: 'Sol Ring' })).toBeVisible()
    await expect(page.getByTestId('detail-price')).toHaveText('€0.91')
    await expect(page.getByTestId('detail-added-price')).toHaveText('€0.91')
    await expect(page.getByTestId('detail-purchase-price')).toHaveText('€1.50')
    await expect(page.getByLabel('Quantity')).toHaveValue('2')
    await expect(page.getByRole('combobox', { name: 'Condition' })).toHaveText('Lightly Played')
  })

  test('AC-27: edit fields and switch printing; matching rows merge', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Lightning Bolt (MSC) 806\n2 Lightning Bolt (FDC) 163')
    await page.goto('/cards?sort=set')
    await expect(tile(page, 'Lightning Bolt')).toHaveCount(2)

    await tile(page, 'Lightning Bolt').last().click() // MSC sorts after FDC
    await expect(page.getByTestId('card-detail')).toContainText('#806')
    await page.getByRole('radio', { name: / #163$/ }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved. It matched another row, so the two merged.')).toBeVisible()
    await expect(tile(page, 'Lightning Bolt')).toHaveCount(1)
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×3')

    await tile(page, 'Lightning Bolt').click()
    await page.getByLabel('Quantity').fill('5')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×5')
  })

  test('AC-28: delete after confirming', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page.getByText('Deleted Sol Ring.')).toBeVisible()
    await expect(tile(page, 'Sol Ring')).toHaveCount(0)
  })
})
