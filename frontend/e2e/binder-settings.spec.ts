import { expect, test } from '@playwright/test'
import { binderSlot as slot, signUpAndLogIn } from './helpers'

// Spec 007: binder settings, resize, page count and sections (AC-6 to AC-11).
test.describe('Binder settings', () => {
  test('AC-6 to AC-9: grid picker, resize keeps places, page count with used slots', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Grid')
    await api.importList('3 Sol Ring (C21) 263', binder)
    const ring = (await api.get(`/api/locations/${binder}/binder/`)).items[0].id
    for (const to of [{ page: 1, row: 1, col: 1 }, { page: 1, row: 2, col: 2 }, { page: 1, row: 3, col: 3 }]) {
      await api.post(`/api/locations/${binder}/binder/move/`, { item: ring, to })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/locations/${binder}`)

    await page.getByRole('button', { name: 'Binder settings' }).click()
    const dialog = page.getByTestId('binder-settings')
    await expect(dialog.getByTestId('grid-size')).toHaveText('3 × 3')
    await dialog.getByRole('button', { name: '2 rows, 4 columns' }).hover()
    await expect(dialog.getByTestId('grid-size')).toHaveText('2 × 4')
    await dialog.getByRole('button', { name: '2 rows, 4 columns' }).click()
    await dialog.getByRole('switch', { name: 'Fixed page count' }).click()
    await dialog.getByLabel('Pages', { exact: true }).fill('5')
    await dialog.getByRole('button', { name: 'Save' }).click()
    // Row 3 is gone: one card loses its slot.
    await expect(page.getByRole('alertdialog')).toContainText('1 card loses its slot')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved. 1 moved to Unplaced.')).toBeVisible()

    await expect(page.getByTestId('binder-page').first().getByTestId('binder-slot')).toHaveCount(8)
    await expect(slot(page, 1, 1, 4)).toHaveAttribute('data-state', 'filled')
    await expect(slot(page, 1, 6, 4)).toHaveAttribute('data-state', 'filled') // row 2, column 2 kept its place
    await expect(page.getByTestId('unplaced-count')).toHaveText('1')
    await expect(page.getByTestId('binder-used')).toHaveText('2 / 40 slots')
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 1 of 5')

    // The shortcuts and facing pages off.
    await page.getByRole('button', { name: 'Binder settings' }).click()
    await dialog.getByRole('button', { name: '4 × 4' }).click()
    await expect(dialog.getByTestId('grid-size')).toHaveText('4 × 4')
    await dialog.getByRole('switch', { name: 'Facing pages' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 2 of 5')
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
  })

  test('AC-10, AC-11: sections show their name and hint at cards outside their filter', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Sections')
    await api.importList('1 Sol Ring (C21) 263\n1 Lightning Bolt (FDC) 163\n1 Llanowar Elves (FDC) 213', binder)
    const rows = (await api.get(`/api/locations/${binder}/binder/`)).items as { id: number; printing: { name: string } }[]
    const id = (name: string) => rows.find((r) => r.printing.name === name)!.id
    await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Lightning Bolt'), to: { page: 1, row: 1, col: 1 } })
    await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Sol Ring'), to: { page: 1, row: 1, col: 2 } })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/locations/${binder}`)

    await page.getByRole('button', { name: 'Binder settings' }).click()
    const dialog = page.getByTestId('binder-settings')
    await dialog.getByRole('button', { name: 'Add section' }).click()
    await dialog.getByLabel('Section name').fill('Red')
    await dialog.getByLabel('Last page').fill('2')
    await dialog.getByRole('button', { name: 'Filters' }).click()
    await page.getByTestId('filter-panel').getByRole('button', { name: 'Red' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByTestId('binder-section').first()).toHaveText('Red')
    await expect(slot(page, 1, 1).getByTestId('mismatch')).toHaveCount(0)
    await expect(slot(page, 1, 2).getByTestId('mismatch')).toHaveCount(1) // Sol Ring isn't red, but it stays

    // Overlapping sections are refused.
    await page.getByRole('button', { name: 'Binder settings' }).click()
    await dialog.getByRole('button', { name: 'Add section' }).click()
    await dialog.getByLabel('Section name').last().fill('Green')
    await dialog.getByLabel('First page').last().fill('2')
    await dialog.getByLabel('Last page').last().fill('3')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Sections may not share pages.')
  })
})
