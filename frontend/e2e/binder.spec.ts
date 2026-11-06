import { expect, test } from '@playwright/test'
import { apiAs, binderSlot as slot, createUser, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 007: the binder view, pages and the public view (AC-1 to AC-5, AC-24).

test.describe('Binder view', () => {
  test('AC-1: only binders offer it; a binder opens in it until another view is picked', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const box = await api.location('Shoebox', 'box')
    const binder = await api.location('Trade binder')

    await page.goto(`/locations/${box}`)
    await expect(page.getByLabel('Grid view')).toBeVisible()
    await expect(page.getByLabel('Binder view')).toHaveCount(0)

    await page.goto(`/locations/${binder}`)
    await expect(page.getByTestId('binder')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filters' })).toBeDisabled() // sort and filters don't apply (spec 009, AC-2)
    await page.getByLabel('Grid view').click()
    await page.goto(`/locations/${binder}`)
    await expect(page.getByTestId('binder')).toHaveCount(0)
    await page.getByLabel('Binder view').click()
    await page.goto(`/locations/${binder}`)
    await expect(page.getByTestId('binder')).toBeVisible()
  })

  test('AC-2 to AC-4: a slot per copy, facing pages, page keys and the page in the URL', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Pages')
    await api.importList('4 Sol Ring (C21) 263\n1 Lightning Bolt (FDC) 163', binder)
    const state = await api.get(`/api/locations/${binder}/binder/`)
    const ring = state.items.find((r: { printing: { name: string } }) => r.printing.name === 'Sol Ring').id
    for (const to of [{ page: 1, row: 1, col: 1 }, { page: 1, row: 1, col: 2 }, { page: 2, row: 3, col: 3 }]) {
      await api.post(`/api/locations/${binder}/binder/move/`, { item: ring, to })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/locations/${binder}`)

    // Page 1 alone on the right of the first spread.
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 1 of 3')
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Sol Ring')
    await expect(slot(page, 1, 2)).toHaveAttribute('data-state', 'filled')
    await expect(slot(page, 1, 3)).toHaveAttribute('data-state', 'empty')
    await expect(page.getByTestId('unplaced-count')).toHaveText('2') // one Sol Ring and the Bolt

    await slot(page, 1, 1).getByRole('button').hover()
    await expect(page.getByTestId('card-preview')).toHaveAttribute('alt', 'Sol Ring')
    await page.mouse.move(0, 0)

    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('binder-pages')).toHaveText('Pages 2–3 of 3')
    await expect(page).toHaveURL(/page=2/)
    await expect(slot(page, 2, 9)).toHaveAttribute('data-state', 'filled')
    await page.screenshot({ path: 'test-results/binder-spread.png' })
    await page.reload()
    await expect(page.getByTestId('binder-pages')).toHaveText('Pages 2–3 of 3')
    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 1 of 3')

    await slot(page, 1, 1).getByRole('button').click()
    await expect(page.getByTestId('card-detail')).toContainText('Sol Ring')
    await page.getByTestId('card-detail').getByRole('button', { name: 'Close' }).last().click()

    // Phones show one page at a time.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/locations/${binder}?page=2`)
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 2 of 3')
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
  })

  test('AC-24: public binders show the binder read-only', async ({ page, request }) => {
    const owner = uniqueUser()
    await createUser(request, owner)
    const api = await apiAs(request, owner)
    const binder = await api.location('Showcase', 'binder', true)
    await api.importList('1 Sol Ring (C21) 263\n1 Lightning Bolt (FDC) 163', binder)
    const ring = (await api.get(`/api/locations/${binder}/binder/`)).items.find((r: { printing: { name: string } }) => r.printing.name === 'Sol Ring').id
    await api.post(`/api/locations/${binder}/binder/move/`, { item: ring, to: { page: 1, row: 1, col: 1 } })

    await page.goto(`/u/${owner.username}/locations/${binder}`)
    await expect(page.getByTestId('binder')).toBeVisible()
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Sol Ring')
    await expect(page.getByTestId('unplaced-tray')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Binder settings' })).toHaveCount(0)
    await expect(slot(page, 1, 2).getByRole('button')).toHaveCount(0) // empty pockets have no menu
  })
})
