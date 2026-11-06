import { expect, test, type Locator, type Page } from '@playwright/test'
import { binderSlot as slot, signUpAndLogIn } from './helpers'

// Spec 009: binder polish (AC-1 to AC-8, AC-10, AC-11, AC-13, AC-14).

type Api = Awaited<ReturnType<typeof signUpAndLogIn>>['api']

/** Sol Rings on pages 1, 2 and 3, a Bolt on page 1, one Sol Ring and one Bolt unplaced. Page 4 is the empty one after. */
async function stockedBinder(api: Api, name = 'Polish binder') {
  const binder = await api.location(name)
  await api.importList('4 Sol Ring (C21) 263\n2 Lightning Bolt (FDC) 163', binder)
  const state = await api.get(`/api/locations/${binder}/binder/`)
  const id = (n: string) => state.items.find((r: { printing: { name: string } }) => r.printing.name === n).id
  for (const to of [{ page: 1, row: 1, col: 1 }, { page: 2, row: 3, col: 3 }, { page: 3, row: 1, col: 1 }]) {
    await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Sol Ring'), to })
  }
  await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Lightning Bolt'), to: { page: 1, row: 1, col: 2 } })
  return binder
}

const more = (page: Page) => page.getByRole('button', { name: 'More' })
const sidebar = (page: Page) => page.getByTestId('unplaced-sidebar')

async function x(locator: Locator) {
  return (await locator.boundingBox())!.x
}

test.describe('Binder polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('AC-1 to AC-3: one toolbar in every view; the ⋯ menu holds the location actions; totals once', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}`)
    await expect(page.getByTestId('binder')).toBeVisible()

    // No buttons next to the name, no gear: everything is in the toolbar.
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Binder settings' })).toHaveCount(0)
    await expect(page.getByTestId('location-totals')).toContainText('6 cards')
    await expect(page.getByTestId('browser-summary')).toHaveCount(0)
    await expect(page.getByTestId('prices-updated')).toHaveCount(0)

    // Binder view: search on, filters and sort in place but disabled.
    const search = page.getByLabel('Search cards')
    const filters = page.getByRole('button', { name: 'Filters' })
    await expect(search).toBeEnabled()
    await expect(filters).toBeDisabled()
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toBeDisabled()
    const inBinder = { search: await x(search), filters: await x(filters), more: await x(more(page)) }

    await page.getByLabel('Grid view').click()
    await expect(filters).toBeEnabled()
    expect(await x(search)).toBe(inBinder.search)
    expect(await x(filters)).toBe(inBinder.filters)
    expect(await x(more(page))).toBe(inBinder.more)

    await more(page).click()
    const items = page.getByRole('menuitem')
    await expect(items).toHaveText(['Binder settings', 'Edit location', 'Import', 'Export', 'Delete'])
    // Binder settings from Grid view: back to the binder, with its settings open.
    await page.getByRole('menuitem', { name: 'Binder settings' }).click()
    await expect(page.getByTestId('binder-settings')).toBeVisible()
    await expect(page.getByTestId('binder')).toBeVisible()
    await page.keyboard.press('Escape')

    await more(page).click()
    await page.getByRole('menuitem', { name: 'Edit location' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit location' })).toBeVisible()
    await page.keyboard.press('Escape')

    // A box has no Binder settings; All cards keeps its own totals line.
    const box = await api.location('Shoebox', 'box')
    await page.goto(`/locations/${box}`)
    await more(page).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Edit location', 'Import', 'Export', 'Delete'])
    await page.keyboard.press('Escape')
    await page.goto('/cards')
    await expect(page.getByTestId('browser-summary')).toContainText('6 cards')
  })

  test('AC-4: S, M and L pocket sizes; facing pages only when both fit; remembered', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}?page=2`)
    const pocket = slot(page, 2, 1)

    await page.getByRole('button', { name: 'Small cards' }).click()
    await expect.poll(async () => (await pocket.boundingBox())!.width).toBe(64)
    await expect(page.getByTestId('binder-page')).toHaveCount(2)

    await page.getByRole('button', { name: 'Large cards' }).click()
    await expect.poll(async () => (await pocket.boundingBox())!.width).toBe(120)
    await expect(page.getByTestId('binder-page')).toHaveCount(1) // two don't fit next to the sidebar
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 2 of 4')

    await page.reload()
    await expect(page.getByRole('button', { name: 'Large cards' })).toHaveAttribute('data-state', 'on')
    await page.getByRole('button', { name: 'Medium cards' }).click()
    await expect(page.getByTestId('binder-page')).toHaveCount(2)
  })

  test('AC-5: search rings matches, fades the rest, jumps to them and filters the sidebar', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}`)

    await page.getByLabel('Search cards').fill('sol')
    await expect(page.getByTestId('binder-match-count')).toHaveText('1 of 3')
    await expect(page).toHaveURL(/q=sol/)
    await expect(slot(page, 1, 1)).toHaveAttribute('data-match', 'current')
    await expect(slot(page, 1, 2)).toHaveAttribute('data-match', 'miss')
    await expect(page.getByTestId('unplaced-card')).toHaveCount(1)
    await expect(page.getByTestId('unplaced-card')).toHaveAccessibleName('Sol Ring')

    await page.getByLabel('Search cards').press('Enter')
    await expect(page.getByTestId('binder-match-count')).toHaveText('2 of 3')
    await expect(page.getByTestId('binder-pages')).toHaveText('Pages 2–3 of 4')
    await expect(slot(page, 2, 9)).toHaveAttribute('data-match', 'current')
    await expect(slot(page, 3, 1)).toHaveAttribute('data-match', 'hit')

    await page.getByRole('button', { name: 'Previous match' }).click()
    await expect(page.getByTestId('binder-match-count')).toHaveText('1 of 3')
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 1 of 4')

    // Opened from a link with the search: it jumps there.
    await page.goto(`/locations/${binder}?q=bolt`)
    await expect(page.getByTestId('binder-match-count')).toHaveText('1 of 1')
    await expect(slot(page, 1, 2)).toHaveAttribute('data-match', 'current')

    await page.getByLabel('Search cards').fill('nothing like it')
    await expect(page.getByTestId('binder-match-count')).toHaveText('No matches')
  })

  test('AC-6: pagination under the pages jumps to a page; used slots under it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}`)
    const nav = page.getByTestId('binder-pagination')
    await expect(nav.getByRole('button', { name: /^Page / })).toHaveText(['1', '2–3', '4'])
    await expect(nav.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    expect((await nav.boundingBox())!.y).toBeGreaterThan((await page.getByTestId('binder-spread').boundingBox())!.y)

    await nav.getByRole('button', { name: 'Page 2–3' }).click()
    await expect(page.getByTestId('binder-pages')).toHaveText('Pages 2–3 of 4')
    await expect(nav.getByRole('button', { name: 'Page 2–3' })).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 1 of 4')
  })

  test('AC-7, AC-8: the sidebar tab shows and hides it, remembered; a drag opens it until the drop', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}`)
    await expect(sidebar(page)).toHaveAttribute('data-state', 'open')
    await expect(page.getByTestId('unplaced-tab')).toHaveText('Unplaced 2')

    await page.getByTestId('unplaced-tab').click()
    await expect(sidebar(page)).toHaveAttribute('data-state', 'closed')
    await expect(page.getByTestId('unplaced-tray')).toHaveCount(0)
    await page.reload()
    await expect(sidebar(page)).toHaveAttribute('data-state', 'closed')

    // Drag the Bolt from slot 2 to slot 3: the sidebar opens while dragging, then closes.
    const from = (await slot(page, 1, 2).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 })
    await expect(page.getByTestId('drag-ghost')).toBeVisible()
    await expect(sidebar(page)).toHaveAttribute('data-state', 'open')
    await expect(page.getByTestId('unplaced-tray')).toBeVisible()
    const to = (await slot(page, 1, 3).boundingBox())! // the pages made room for the sidebar
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect(slot(page, 1, 3)).toHaveAttribute('data-state', 'filled')
    await expect(sidebar(page)).toHaveAttribute('data-state', 'closed')
  })

  test('AC-10, AC-11: a new binder gets its layout in the create dialog, then opens', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/')
    await page.getByRole('button', { name: 'New location' }).click()
    const dialog = page.getByRole('dialog', { name: 'New location' })
    await dialog.getByLabel('Name').fill('Fresh binder')
    await dialog.getByRole('button', { name: '2 × 2' }).click()
    await dialog.getByRole('switch', { name: 'Facing pages' }).click()
    await dialog.getByRole('switch', { name: 'Fixed page count' }).click()
    await dialog.getByRole('spinbutton', { name: 'Pages' }).fill('4')
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(page).toHaveURL(/\/locations\/\d+$/)
    await expect(page.getByTestId('location-name')).toHaveText('Fresh binder')
    await expect(page.getByTestId('binder-used')).toHaveText('0 / 16 slots')
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
    await expect(page.getByTestId('binder-slot')).toHaveCount(4)

    // Any other kind opens too, without the binder layout.
    await page.goto('/')
    await page.getByRole('button', { name: 'New location' }).click()
    await dialog.getByLabel('Name').fill('Fresh box')
    await dialog.getByLabel('Box', { exact: true }).click()
    await expect(dialog.getByTestId('grid-picker')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('location-name')).toHaveText('Fresh box')
  })

  test('AC-13, AC-14: section filters inline; their mana symbols show by the section name', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await stockedBinder(api)
    await page.goto(`/locations/${binder}`)
    await more(page).click()
    await page.getByRole('menuitem', { name: 'Binder settings' }).click()
    const settings = page.getByTestId('binder-settings')
    await settings.getByRole('button', { name: 'Add section' }).click()
    const row = settings.getByTestId('section-row')
    await row.getByLabel('Section name').fill('Blue and red')
    await row.getByLabel('Last page').fill('3')
    const filter = row.getByTestId('section-filter')
    await expect(filter.getByLabel('Blue')).toBeVisible()
    await expect(filter.getByText('Rarity')).toBeVisible()
    await filter.getByLabel('Blue').click()
    await filter.getByLabel('Red').click()
    await expect(row.getByTestId('section-colors').locator('img')).toHaveCount(2)
    await settings.getByRole('button', { name: 'Save' }).click()
    await expect(settings).toBeHidden()

    await expect(page.getByTestId('binder-section').first()).toHaveText('Blue and red')
    await expect(page.getByTestId('section-colors').first().locator('img')).toHaveCount(2)
  })
})
