import { expect, test, type Page } from '@playwright/test'
import { apiAs, choose, createUser, locationTile, pressed, signUpAndLogIn, tile, uniqueUser } from './helpers'

// Spec 010: the want list (AC-1 to AC-13, AC-18). Deck parts are in deck-wants.spec.ts.
const detail = (page: Page) => page.getByTestId('card-detail')
const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text })

type Api = Awaited<ReturnType<typeof apiAs>>
/** A printing id of a card, newest first, or of one set. */
async function printingOf(api: Api, name: string, set?: string): Promise<string> {
  const card = (await api.get(`/api/catalog/cards/?q=${encodeURIComponent(name)}`))[0]
  const printings: { id: string; set_code: string }[] = await api.get(`/api/catalog/cards/${card.oracle_id}/printings/`)
  return (set ? printings.find((p) => p.set_code === set)! : printings[0]).id
}

/** Open Rhystic Study from Sol Ring's Played with tab (EDHREC fixture). */
async function openRhystic(page: Page) {
  await tile(page, 'Sol Ring').click()
  await detail(page).getByRole('tab', { name: 'Played with' }).click()
  await page.getByTestId('edhrec-played-with').getByRole('button', { name: 'Rhystic Study', exact: true }).click()
  await expect(detail(page).getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()
}

test.describe('Want list', () => {
  test('AC-1, AC-3, AC-4, AC-13: the card dialog adds to the want list, and Add picks the page location', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Red', 'binder')
    await api.location('Blue', 'box')
    await api.importList('1 Sol Ring (C21) 263', binder)
    await page.goto(`/locations/${binder}?view=grid`)
    await openRhystic(page)
    await expect(page.getByTestId('owned')).toHaveText('You own 0')

    await detail(page).getByTestId('add-want').click()
    await expect(toast(page, 'Added Rhystic Study to the want list.')).toBeVisible()
    await expect(detail(page).getByTestId('add-want')).toHaveText('Add to want list (1)')
    await detail(page).getByTestId('add-want').click()
    await expect(detail(page).getByTestId('add-want')).toHaveText('Add to want list (2)')
    const [entry] = (await api.get('/api/wants/')).results
    expect(entry).toMatchObject({ quantity: 2, any_printing: true, finish: 'any', deck: null })

    await detail(page).getByRole('button', { name: 'Add', exact: true }).click()
    const add = page.getByRole('dialog', { name: 'Add Rhystic Study' })
    await expect(pressed(page, 'Location')).toHaveText('Red')
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(toast(page, 'Added 1 × Rhystic Study')).toBeVisible()
    // The new copy lowers the want list (AC-13).
    expect((await api.get('/api/wants/')).results[0].quantity).toBe(1)
  })

  test('AC-6, AC-7, AC-8: a tile with count and cost; a page like a location; not part of the collection', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const fdc = await printingOf(api, 'Lightning Bolt', 'fdc')
    await api.post('/api/wants/', { printing: fdc, quantity: 2 })
    await api.post('/api/wants/', { printing: fdc }) // merges (AC-5)
    await api.post('/api/wants/', { printing: await printingOf(api, 'Sol Ring'), any_printing: false })

    await page.goto('/')
    await expect(locationTile(page, 'Want list').getByTestId('location-count')).toHaveText('4 cards')
    await expect(locationTile(page, 'Want list').getByTestId('location-value')).toHaveText('€6.55') // 3 × 1.88 + 0.91
    await locationTile(page, 'Want list').getByRole('link').click()
    await expect(page).toHaveURL(/\/wants$/)
    await expect(page.getByTestId('location-totals')).toContainText('4 cards')
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×3')

    await page.getByLabel('Search cards').fill('sol')
    await expect(page.getByTestId('card-tile')).toHaveCount(1)
    await page.getByLabel('Search cards').fill('')
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByTestId('filter-panel')).not.toContainText('Condition')
    await page.keyboard.press('Escape')

    await page.getByLabel('Table view').click()
    const sol2 = page.getByTestId('card-row').filter({ hasText: 'Sol Ring' })
    await expect(sol2.getByTestId('want-printing')).toHaveText('C21 #263')
    await expect(page.getByTestId('card-row').filter({ hasText: 'Lightning Bolt' }).getByTestId('want-printing')).toHaveText('Any')
    await expect(page.getByTestId('card-checkbox')).toHaveCount(0)

    // Not in the collection (AC-6).
    await page.goto('/cards')
    await expect(page.getByTestId('browser-empty')).toHaveText('No cards yet.')
  })

  test('AC-9 to AC-12: add, open, edit and delete entries; Add to collection fills the Add dialog', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const box = await api.location('Trade box', 'box')
    await page.goto('/wants')
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByTestId('want-dialog')
    await page.getByLabel('Card name').fill('bolt')
    await page.getByTestId('card-results').getByRole('button', { name: 'Lightning Bolt', exact: true }).click()
    await dialog.getByLabel('Quantity').fill('3')
    await choose(page, 'Finish', 'Foil')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(toast(page, 'Added 3 × Lightning Bolt to the want list.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×3')

    await tile(page, 'Lightning Bolt').click()
    const entry = page.getByTestId('want-entry')
    await expect(entry.getByTestId('want-quantity')).toHaveText('3')
    await expect(entry.getByTestId('want-printing')).toHaveText('Any')
    await expect(entry.getByTestId('want-finish')).toHaveText('Foil')
    await entry.getByRole('button', { name: 'Edit' }).click()
    await dialog.getByLabel('Quantity').fill('2')
    await dialog.getByRole('checkbox', { name: 'Any printing' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(entry.getByTestId('want-quantity')).toHaveText('2')
    await expect(entry.getByTestId('want-printing')).not.toHaveText('Any')

    await entry.getByRole('button', { name: 'Add to collection' }).click()
    const add = page.getByRole('dialog', { name: 'Add Lightning Bolt' })
    await expect(add.getByLabel('Quantity')).toHaveValue('2')
    await expect(pressed(page, 'Finish')).toHaveText('Foil')
    await add.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Trade box' }).click()
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    // Bought: the entry is gone and the dialog closes (AC-13).
    await expect(page.getByTestId('browser-empty')).toBeVisible()
    await expect(detail(page)).toHaveCount(0)
    expect((await api.get(`/api/locations/${box}/`)).card_count).toBe(2)

    await api.post('/api/wants/', { printing: await printingOf(api, 'Sol Ring') })
    await page.reload()
    await tile(page, 'Sol Ring').click({ button: 'right' })
    await expect(page.getByRole('menuitem')).toHaveText(['Open', 'Edit', 'Add to collection', 'Delete'])
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(toast(page, 'Deleted Sol Ring from the want list.')).toBeVisible()
    await expect(page.getByTestId('browser-empty')).toBeVisible()
  })

  test('AC-18: a Public switch shows the want list on the profile, read-only', async ({ page, request, browser }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    await api.post('/api/wants/', { printing: await printingOf(api, 'Sol Ring') })

    const visitor = await (await browser.newContext()).newPage()
    await visitor.goto(`/u/${user.username}/wants`)
    await expect(visitor.getByRole('heading', { name: 'Want list not found' })).toBeVisible()

    await page.goto('/wants')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Public' }).click()
    await expect(toast(page, 'Your want list is public.')).toBeVisible()
    await expect(page.getByTestId('wants-public')).toBeVisible()

    await visitor.goto(`/u/${user.username}`)
    await locationTile(visitor, 'Want list').getByRole('link').click()
    await expect(visitor).toHaveURL(new RegExp(`/u/${user.username}/wants$`))
    await expect(visitor.getByRole('button', { name: 'Add card' })).toHaveCount(0)
    await tile(visitor, 'Sol Ring').click()
    await expect(visitor.getByTestId('want-entry').getByTestId('want-quantity')).toHaveText('1')
    await expect(visitor.getByTestId('want-entry').getByRole('button')).toHaveCount(0)
    await expect(visitor.getByTestId('want-deck')).toHaveCount(0)

    // Listed in the directory although nothing else is public.
    const other = uniqueUser('dir')
    await createUser(request, other)
    const visitorApi = await apiAs(request, other)
    const directory = await visitorApi.get(`/api/users/?q=${user.username}`)
    expect(directory.map((u: { username: string }) => u.username)).toContain(user.username)
  })
})
