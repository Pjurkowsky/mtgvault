import { expect, test, type Page } from '@playwright/test'
import { choose, locationTile, signUpAndLogIn, tile } from './helpers'

// Spec 003 AC-17 to AC-22. Cards enter the cart through the scanner's own endpoint.
const SOL_RING_C21 = '4cbc6901-6a4a-4d0a-83ea-7eefa3b35021'

async function setup(page: Page, request: import('@playwright/test').APIRequestContext) {
  const { user, api } = await signUpAndLogIn(page, request)
  const scan = (galleryId: string) => api.post('/api/scanner/scans/', { gallery_id: galleryId })
  return { user, api, scan }
}

test.describe('Cart', () => {
  test('AC-17, AC-19: scans merge in the cart; the Cart tile shows count and value', async ({ page, request }) => {
    const { scan } = await setup(page, request)
    await scan(SOL_RING_C21)
    const second = await scan(SOL_RING_C21)
    expect(second.merged).toBe(true)
    await page.reload()
    const cart = locationTile(page, 'Cart')
    await expect(cart.getByTestId('location-count')).toHaveText('2 cards')
    await expect(cart.getByTestId('location-value')).toHaveText('€1.82')
    await cart.getByRole('link').click()
    await expect(page.getByTestId('location-name')).toHaveText('Cart')
    await expect(tile(page, 'Sol Ring').getByTestId('card-quantity')).toHaveText('×2')
  })

  test('AC-18: cart cards are not part of the collection', async ({ page, request }) => {
    const { user, api, scan } = await setup(page, request)
    await api.location('Shelf', 'box', true)
    await scan(SOL_RING_C21)
    await page.goto('/cards')
    await expect(page.getByTestId('browser-empty')).toBeVisible()
    await page.goto('/')
    await expect(locationTile(page, 'Unfiled').getByTestId('location-count')).toHaveText('0 cards')
    expect((await api.post('/api/items/export/', { selection: { filter: {} } })).text.trim()).toBe('')
    const publicLocations = await api.get(`/api/users/${user.username}/locations/`)
    expect(publicLocations.locations[0].card_count).toBe(0)
  })

  test('AC-20, AC-22: the cart page is a card browser without Add card or Import', async ({ page, request }) => {
    const { scan } = await setup(page, request)
    await scan(SOL_RING_C21)
    await page.goto('/locations/cart')
    await expect(tile(page, 'Sol Ring')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('menuitem', { name: 'Import' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
    await page.keyboard.press('Escape')

    await tile(page, 'Sol Ring').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(page.getByTestId('edit-dialog').getByRole('group', { name: 'Location' })).toHaveCount(0)
    await page.getByTestId('edit-dialog').getByLabel('Quantity').fill('3')
    await page.getByTestId('edit-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(tile(page, 'Sol Ring').getByTestId('card-quantity')).toHaveText('×3')
    await expect(page.getByTestId('location-totals')).toContainText('3 cards') // still in the cart

    await page.getByTestId('card-checkbox').first().click()
    // Scanned cards are bought: no Move to want list (spec 010, AC-19).
    await expect(page.getByTestId('selection-bar').getByRole('button', { name: 'Move to want list' })).toHaveCount(0)
  })

  test('AC-21: Move to sends cart cards into a location, merging with matching rows', async ({ page, request }) => {
    const { api, scan } = await setup(page, request)
    const shelf = await api.location('Shelf', 'box')
    await api.importList('1 Sol Ring (C21) 263', shelf)
    await scan(SOL_RING_C21)
    await scan(SOL_RING_C21)
    await page.goto('/locations/cart')
    await page.getByTestId('card-checkbox').first().click()
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Move to', exact: true }).click()
    await expect(page.getByTestId('bulk-counts')).toHaveText('1 row, 2 cards.')
    await choose(page, 'Move to', 'Shelf')
    await page.getByTestId('bulk-dialog').getByRole('button', { name: 'Move' }).click()
    await expect(page.getByText('Moved 2 cards.')).toBeVisible()
    await expect(page.getByTestId('browser-empty')).toBeVisible()
    await page.goto('/')
    await expect(locationTile(page, 'Shelf').getByTestId('location-count')).toHaveText('3 cards')
    await expect(locationTile(page, 'Cart').getByTestId('location-count')).toHaveText('0 cards')
  })
})
