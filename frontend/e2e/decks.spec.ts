import { expect, test } from '@playwright/test'
import { choose, deckMenu, deckRow, locationTile, signUpAndLogIn, tile } from './helpers'

const deckTile = (page: import('@playwright/test').Page, name: string) => page.getByTestId('deck-tile').filter({ hasText: name })

test.describe('Decks', () => {
  test('AC-1, AC-2, AC-3: new private deck from the top bar, shown as a tile', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.getByRole('link', { name: 'Decks' }).click()
    await expect(page).toHaveURL(/\/decks$/)
    await page.getByRole('button', { name: 'New deck' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('switch', { name: 'Public' })).not.toBeChecked()
    await expect(dialog.getByRole('switch', { name: 'Create deck box' })).not.toBeChecked()
    await dialog.getByRole('combobox', { name: 'Format' }).click()
    for (const f of ['Commander', 'Brawl', 'Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Casual']) {
      await expect(page.getByRole('option', { name: f, exact: true })).toBeVisible()
    }
    await page.getByRole('option', { name: 'Modern', exact: true }).click()
    await dialog.getByLabel('Name').fill('Burn')
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(page).toHaveURL(/\/decks\/\d+$/)
    await expect(page.getByTestId('deck-name')).toHaveText('Burn')
    await expect(page.getByTestId('deck-format')).toHaveText('Modern')
    await expect(page.getByTestId('deck-box')).toHaveCount(0)

    await page.getByRole('link', { name: 'Decks' }).first().click()
    const burn = deckTile(page, 'Burn')
    await expect(burn).toContainText('Modern')
    await expect(burn.getByTestId('deck-tile-counts')).toHaveText('0/60 cards · 0 owned · 0 missing')
    await expect(burn.getByLabel('Public')).toHaveCount(0)
  })

  test('AC-2: a new deck can get a deck box right away', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/decks')
    await page.getByRole('button', { name: 'New deck' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Elves')
    await dialog.getByRole('switch', { name: 'Create deck box' }).click()
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('deck-box')).toHaveText('Elves')
    await page.getByTestId('deck-box').click()
    await expect(page.getByTestId('location-name')).toHaveText('Elves')
    await expect(page.getByTestId('location-kind')).toHaveText('Deck box')
  })

  test('AC-4: deck box locations create their deck; changing the kind unlinks it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const box = await api.location('Gruul Box', 'deck_box', true)
    await page.goto('/decks')
    const gruul = deckTile(page, 'Gruul Box')
    await expect(gruul).toContainText('Commander') // spec 005, AC-18
    await expect(gruul.getByLabel('Has a deck box')).toBeVisible()
    await expect(gruul.getByLabel('Public')).toBeVisible()

    await api.patch(`/api/locations/${box}/`, { kind: 'binder' })
    await page.reload()
    await expect(deckTile(page, 'Gruul Box').getByLabel('Has a deck box')).toHaveCount(0)

    await api.patch(`/api/locations/${box}/`, { kind: 'deck_box' })
    await page.reload()
    await expect(page.getByTestId('deck-tile')).toHaveCount(2)
  })

  test('AC-5: Create deck box moves the ticked free copies into it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Binder')
    await api.importList('1 Sol Ring (C21) 263\n2 Counterspell (FDC) 61', binder)
    const deck = await api.deck('Control', 'casual', { text: '1 Sol Ring\n2 Counterspell\n1 Forest' })
    await page.goto(`/decks/${deck.id}`)
    await expect(deckRow(page, 'Sol Ring').getByTestId('ownership')).toHaveAttribute('data-state', 'owned')

    await deckMenu(page, 'Create deck box')
    const dialog = page.getByTestId('create-box-dialog')
    await expect(dialog.getByRole('checkbox')).toHaveCount(2)
    await expect(dialog).toContainText('2 Counterspell')
    await expect(dialog).toContainText('Binder')
    await dialog.getByRole('checkbox', { name: /Counterspell/ }).click()
    await dialog.getByRole('button', { name: 'Create and move 1' }).click()

    await expect(page.getByTestId('deck-box')).toHaveText('Control')
    await expect(deckRow(page, 'Sol Ring').getByTestId('ownership')).toHaveAttribute('data-state', 'in_box')
    await expect(deckRow(page, 'Counterspell').getByTestId('ownership')).toHaveAttribute('data-state', 'owned')
    await page.getByTestId('deck-box').click()
    await expect(tile(page, 'Sol Ring')).toBeVisible()
    await expect(tile(page, 'Counterspell')).toHaveCount(0)
  })

  test('AC-6: deleting a deck with a box asks about the box', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const keep = await api.deck('Keeper', 'casual', { create_box: true })
    const unfile = await api.deck('Unfiler', 'casual', { create_box: true })
    await api.importList('2 Sol Ring (C21) 263', keep.location)
    await api.importList('1 Forest (M21) 272', unfile.location)
    const dialog = page.getByRole('alertdialog')

    await page.goto(`/decks/${keep.id}`)
    await deckMenu(page, 'Delete')
    await expect(dialog.getByRole('radio', { name: 'Keep it as a normal location' })).toBeChecked()
    await dialog.getByRole('button', { name: 'Delete deck' }).click()
    await expect(page).toHaveURL(/\/decks$/)
    await expect(deckTile(page, 'Keeper')).toHaveCount(0)

    await page.goto(`/decks/${unfile.id}`)
    await deckMenu(page, 'Delete')
    await dialog.getByRole('radio', { name: 'Move its cards to Unfiled' }).click()
    await dialog.getByRole('button', { name: 'Delete deck' }).click()
    await expect(page).toHaveURL(/\/decks$/)

    await page.goto('/')
    await expect(locationTile(page, 'Keeper').getByLabel('Box', { exact: true })).toBeVisible()
    await expect(locationTile(page, 'Keeper').getByTestId('location-count')).toHaveText('2 cards')
    await expect(locationTile(page, 'Unfiler')).toHaveCount(0)
    await expect(locationTile(page, 'Unfiled').getByTestId('location-count')).toHaveText('1 card')
  })

  test('AC-6: a deck without a box deletes after a confirm', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Plain')
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Delete')
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('deck-name')).toHaveText('Plain')
    await deckMenu(page, 'Delete')
    await dialog.getByRole('button', { name: 'Delete deck' }).click()
    await expect(page.getByText('No decks yet.')).toBeVisible()
  })

  test('AC-7: name, format and visibility can be edited', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Draft')
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Edit')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Final')
    await choose(page, 'Format', 'Pauper')
    await dialog.getByRole('switch', { name: 'Public' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('deck-name')).toHaveText('Final')
    await expect(page.getByTestId('deck-format')).toHaveText('Pauper')
    await expect(page.getByLabel('Public')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('deck-name')).toHaveText('Final')
  })

  test('AC-29: cards put into a deck box join its decklist; taking them out does not', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const box = await api.location('Mono Red', 'deck_box')
    const decks = await api.get('/api/decks/')
    const deck = decks.decks.find((d: { name: string }) => d.name === 'Mono Red')
    await api.importList('2 Lightning Bolt (FDC) 163', box)
    await api.importList('1 Counterspell (FDC) 61')

    // Move the Unfiled Counterspell into the box from the collection.
    await page.goto('/cards')
    await tile(page, 'Counterspell').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await page.getByTestId('edit-dialog').getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Mono Red' }).click()
    await page.getByTestId('edit-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('edit-dialog')).toBeHidden()

    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('group-main-Instants')).toContainText('Instants (3)')
    await expect(deckRow(page, 'Lightning Bolt')).toContainText('2')
    await expect(deckRow(page, 'Counterspell').getByTestId('ownership')).toHaveAttribute('data-state', 'in_box')

    const items = await api.get(`/api/items/?location=${box}&q=bolt`)
    await api.patch(`/api/items/${items.results[0].id}/`, { location: null })
    await page.reload()
    await expect(deckRow(page, 'Lightning Bolt')).toContainText('2')
    await expect(deckRow(page, 'Lightning Bolt').getByTestId('ownership')).toHaveAttribute('data-state', 'owned')

    // A location that becomes a Deck box brings its cards into the new deck.
    const binder = await api.location('Green Binder')
    await api.importList('3 Forest (M21) 272', binder)
    await api.patch(`/api/locations/${binder}/`, { kind: 'deck_box' })
    const green = (await api.get('/api/decks/')).decks.find((d: { name: string }) => d.name === 'Green Binder')
    await page.goto(`/decks/${green.id}`)
    await expect(deckRow(page, 'Forest')).toContainText('3')
  })
})
