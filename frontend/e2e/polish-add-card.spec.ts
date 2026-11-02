import { expect, test, type Page } from '@playwright/test'
import { pressed, signUpAndLogIn, tile } from './helpers'

async function openAndSearch(page: Page, q: string) {
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByLabel('Card name').fill(q)
  await expect(page.getByTestId('card-results')).toBeVisible()
}

test.describe('Add card (spec 002)', () => {
  test('AC-7, AC-8: grid or list, sizes, remembered', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAndSearch(page, 'lightning')
    await expect(page.getByTestId('card-results')).toHaveAttribute('data-size', 'md')
    await expect(page.getByTestId('card-results').getByRole('img').first()).toBeVisible()
    await page.getByRole('button', { name: 'Large cards' }).click()
    await expect(page.getByTestId('card-results')).toHaveAttribute('data-size', 'lg')
    await page.getByRole('button', { name: 'Results as list' }).click()
    await expect(page.getByTestId('card-results')).toContainText('Lightning Bolt')
    await expect(page.getByTestId('card-results')).not.toHaveAttribute('data-size')

    await page.keyboard.press('Escape')
    await openAndSearch(page, 'lightning')
    await expect(page.getByTestId('card-results')).not.toHaveAttribute('data-size') // list remembered
    await page.getByRole('button', { name: 'Results as grid' }).click()
    await expect(page.getByTestId('card-results')).toHaveAttribute('data-size', 'lg') // size remembered
  })

  test('AC-9: hovering a result shows a large preview', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAndSearch(page, 'sol ring')
    await page.getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).hover()
    await expect(page.getByTestId('card-preview')).toBeVisible()
  })

  test('AC-10: finish is a toggle group', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await openAndSearch(page, 'delver')
    await page.getByTestId('card-results').getByRole('button', { name: /^Delver/ }).click()
    await page.getByRole('group', { name: 'Finish' }).getByRole('button', { name: 'Foil', exact: true }).click()
    await expect(pressed(page, 'Finish')).toHaveText('Foil')
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(tile(page, 'Delver of Secrets // Insectile Aberration')).toContainText('foil')
  })

  test('AC-11: location toggles up to 6 locations, a searchable list beyond', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    for (let n = 1; n <= 6; n++) await api.location(`Box ${n}`, 'box')
    await page.goto('/cards')
    await openAndSearch(page, 'sol ring')
    await page.getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Location' }).getByRole('button')).toHaveCount(7) // Unfiled + 6
    await page.keyboard.press('Escape')

    await api.location('Box 7', 'box')
    await page.reload()
    await openAndSearch(page, 'sol ring')
    await page.getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Location' })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Location' }).click()
    await page.getByPlaceholder('Search locations').fill('box 7')
    await page.getByRole('option', { name: 'Box 7' }).click()
    await expect(page.getByRole('combobox', { name: 'Location' })).toHaveText('Box 7')
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Sol Ring.')).toBeVisible()
    const rows = await api.get('/api/items/')
    expect(rows.results[0].location_name).toBe('Box 7')
  })
})
