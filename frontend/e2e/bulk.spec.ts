import { expect, test, type Page } from '@playwright/test'
import { check, choose, fixtureList, locationTile, selectAll, signUpAndLogIn, tile } from './helpers'

const bar = (page: Page) => page.getByTestId('selection-bar')
const selected = (page: Page) => page.getByTestId('selected-count')

// Spec 002 replaced the Select button (spec 001 AC-38): checkboxes start a selection.
test.describe('Selection and bulk actions', () => {
  test('AC-38: checkboxes select; while selecting, clicks toggle; Shift-click selects a range', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList(fixtureList())
    await page.goto('/cards')
    const tiles = page.getByTestId('card-tile')
    await page.getByTestId('card-checkbox').nth(0).click()
    await tiles.nth(1).click()
    await expect(selected(page)).toHaveText('2 selected')
    await tiles.nth(1).click()
    await expect(selected(page)).toHaveText('1 selected')
    await tiles.nth(5).click({ modifiers: ['Shift'] })
    await expect(selected(page)).toHaveText('6 selected')
    await expect(tiles.nth(3)).toHaveAttribute('data-selected', 'true')
  })

  test('AC-39, AC-40, AC-41: Select all covers unloaded rows; selection survives search; move with counts', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.location('Archive', 'box')
    await api.importList(fixtureList())
    await api.importList(fixtureList(), null, { condition: 'LP' })
    await page.goto('/cards')
    await expect(page.getByTestId('card-tile')).toHaveCount(60)

    await selectAll(page)
    await expect(selected(page)).toHaveText('92 selected')

    // AC-40: changing search keeps the selection; deselecting one counts down
    await page.getByLabel('Search cards').fill('bolt')
    await expect(page.getByTestId('browser-summary')).toContainText('16 cards')
    await expect(selected(page)).toHaveText('92 selected')
    await page.getByTestId('card-tile').first().click()
    await expect(selected(page)).toHaveText('91 selected')
    await page.getByTestId('card-tile').first().click()
    await page.getByLabel('Search cards').fill('')

    // AC-41: confirm step with counts
    await bar(page).getByRole('button', { name: 'Move' }).click()
    await expect(page.getByTestId('bulk-counts')).toHaveText('92 rows, 92 cards.')
    await choose(page, 'Move to', 'Archive')
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Move' }).click()
    await expect(page.getByText('Moved 92 cards.')).toBeVisible()
    await page.goto('/')
    await expect(locationTile(page, 'Archive').getByTestId('location-count')).toHaveText('92 cards')

    await page.goto('/cards')
    await selectAll(page)
    await expect(selected(page)).toHaveText('92 selected')
    await bar(page).getByTestId('select-all').click() // all selected: clears
    await expect(bar(page)).toHaveCount(0)
  })

  test('AC-42: bulk finish edit skips rows without that finish', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Fire // Ice (MH2) 290\n1 Sol Ring (C21) 263\n1 Forest (M21) 272')
    await page.goto('/cards')
    await selectAll(page)
    await bar(page).getByRole('button', { name: 'Edit' }).click()
    await choose(page, 'Finish', 'Etched')
    await expect(page.getByTestId('bulk-counts')).toHaveText('1 row, 1 card. 2 rows will be skipped: no such finish.')
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('Updated 1 card.')).toBeVisible()
    await expect(tile(page, 'Fire // Ice')).toContainText('etched')
  })

  test('AC-43, AC-44: bulk edit merges rows; works the same on a location page', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Binder')
    await api.importList('1 Sol Ring (C21) 263', binder)
    await api.importList('2 Sol Ring (C21) 263', binder, { condition: 'LP' })
    await api.importList('1 Forest (M21) 272', binder)
    await page.goto('/')
    await locationTile(page, 'Binder').getByRole('link').click()
    await page.getByLabel('Grid view').click() // binders open in binder view (spec 007)
    await expect(tile(page, 'Sol Ring')).toHaveCount(2)

    await check(page, 'Sol Ring')
    await tile(page, 'Sol Ring').last().click()
    await expect(selected(page)).toHaveText('2 selected')
    await bar(page).getByRole('button', { name: 'Edit' }).click()
    await choose(page, 'Condition', 'Near Mint')
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Apply' }).click()
    await expect(tile(page, 'Sol Ring')).toHaveCount(1)
    await expect(tile(page, 'Sol Ring').getByTestId('card-quantity')).toHaveText('×3')

    await selectAll(page)
    await bar(page).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('bulk-counts')).toHaveText('2 rows, 4 cards.')
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('browser-empty')).toBeVisible()
    await expect(page.getByTestId('location-totals')).toHaveText('0 cards · –')
  })
})
