import { expect, test } from '@playwright/test'
import { createUser, locationTile, logOut, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 005: Missing and Owned tabs, the Scan button, deck boxes (AC-14, AC-15, AC-18 to AC-20).
const deckTile = (page: import('@playwright/test').Page, name: string) => page.getByTestId('deck-tile').filter({ hasText: name })

test.describe('Deck boxes and tabs', () => {
  // AC-14's want list item is in the card menu now (spec 006, AC-8; deck-filters.spec.ts).
  test('AC-15: Scan cards in the header, asking where cards go', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tabs', 'casual', { create_box: true, text: '1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByRole('button', { name: 'Scan cards' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Scan cards' }).click()
    const dialog = page.getByTestId('scan-target')
    await expect(dialog.getByRole('radio', { name: 'A location' })).toBeChecked()
    await expect(dialog.getByRole('combobox', { name: 'Location' })).toHaveText('Tabs')
    await expect(dialog.getByRole('radio', { name: 'The cart' })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: 'The decklist only' })).toBeVisible()
  })

  test('AC-18: Format for Deck box locations, both ways', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.getByRole('button', { name: 'New location' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Burn')
    await expect(dialog.getByLabel('Format')).toHaveCount(0)
    await dialog.getByRole('radio', { name: 'Deck box' }).click()
    await expect(dialog.getByRole('combobox', { name: 'Format' })).toHaveText('Commander')
    await dialog.getByRole('combobox', { name: 'Format' }).click()
    await page.getByRole('option', { name: 'Modern' }).click()
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(locationTile(page, 'Burn')).toBeVisible()

    const deck = (await api.get('/api/decks/')).decks[0]
    expect(deck.format).toBe('modern')
    await api.patch(`/api/decks/${deck.id}/`, { format: 'pauper' })
    await page.reload()
    await page.getByRole('button', { name: 'Burn options' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(dialog.getByRole('combobox', { name: 'Format' })).toHaveText('Pauper')
  })

  test('AC-19, AC-20: deck and box share visibility; the box is counted once, as the deck, and linked from it', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Shared box', 'commander', { create_box: true, text: '1 Sol Ring' })
    const binder = await api.location('Trades', 'binder', true)
    await api.importList('1 Forest (M21) 272', binder)

    await api.patch(`/api/decks/${deck.id}/`, { is_public: true })
    let locations = (await api.get('/api/locations/')).locations as { id: number; is_public: boolean }[]
    expect(locations.find((l) => l.id === deck.location)?.is_public).toBe(true)
    await api.patch(`/api/locations/${deck.location}/`, { is_public: false })
    expect((await api.get(`/api/decks/${deck.id}/`)).is_public).toBe(false)
    await api.patch(`/api/locations/${deck.location}/`, { is_public: true })
    expect((await api.get(`/api/decks/${deck.id}/`)).is_public).toBe(true)
    locations = (await api.get('/api/locations/')).locations
    expect(locations.find((l) => l.id === deck.location)?.is_public).toBe(true)

    await logOut(page)
    await createUser(request, uniqueUser('v'))
    await page.goto('/users')
    await page.getByLabel('Search users').fill(user.username)
    await expect(page.getByTestId('directory')).toHaveText(`${user.username}1 public location · 1 public deck`)
    await page.goto(`/u/${user.username}`)
    await expect(locationTile(page, 'Trades')).toBeVisible()
    await expect(locationTile(page, 'Shared box')).toHaveCount(0)
    await expect(deckTile(page, 'Shared box')).toBeVisible()

    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await page.getByTestId('deck-box').click()
    await expect(page).toHaveURL(new RegExp(`/u/${user.username}/locations/${deck.location}$`))
  })
})
