import { expect, test } from '@playwright/test'
import { closeCardDialog, createUser, deckMenu, deckRow, logOut, signUpAndLogIn, uniqueUser } from './helpers'

test.describe('Deck import, export and public decks', () => {
  test('AC-25, AC-26: Import deck previews zones and unrecognized lines, then creates the deck', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/decks')
    await page.getByRole('button', { name: 'Import deck' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Imported')
    await page.getByRole('combobox', { name: 'Format' }).click()
    await page.getByRole('option', { name: 'Modern', exact: true }).click()
    await dialog.getByLabel('Decklist').fill([
      'Deck:',
      '4 Lightning Bolt (FDC) 163',
      '2 Counterspell',
      'Not A Real Card',
      '',
      'Sideboard',
      '1 Shivan Dragon',
      'SB: 2 Swords to Plowshares',
      '',
      'Maybeboard',
      '1 Sol Ring',
    ].join('\n'))
    await dialog.getByRole('button', { name: 'Preview' }).click()
    await expect(dialog.getByTestId('deck-import-main')).toHaveText(/4 Lightning Bolt\s*2 Counterspell/)
    await expect(dialog.getByTestId('deck-import-side')).toHaveText(/1 Shivan Dragon\s*2 Swords to Plowshares/)
    await expect(dialog.getByTestId('deck-import-maybe')).toHaveText('1 Sol Ring')
    await expect(dialog.getByTestId('deck-import-errors')).toContainText('Line 4: Not A Real Card')
    await dialog.getByRole('button', { name: 'Create with 10 cards' }).click()

    await expect(page.getByTestId('deck-name')).toHaveText('Imported')
    await expect(page.getByTestId('group-side')).toContainText('Sideboard (3)')
    await expect(page.getByTestId('group-maybe')).toContainText('Maybeboard (1)')
    await expect(page.getByTestId('deck-size')).toHaveText('6 / 60 cards')
  })

  test('AC-25, AC-26: Import on a deck page adds to it; a Commander heading fills the Commander zone', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Add more', 'commander', { text: '1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Import')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Decklist').fill('Commander\n1 The Prismatic Piper\n\nMainboard\n1 Sol Ring\n3 Forest')
    await dialog.getByRole('button', { name: 'Preview' }).click()
    await expect(dialog.getByTestId('deck-import-commander')).toHaveText('1 The Prismatic Piper')
    await dialog.getByRole('button', { name: 'Add 5 cards' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('deck-commander').getByRole('button', { name: 'The Prismatic Piper' })).toBeVisible() // spec 021, AC-5
    await expect(deckRow(page, 'Sol Ring')).toContainText('2')
    await expect(page.getByTestId('deck-size')).toHaveText('6 / 100 cards')
  })

  test('AC-27: export gives zone headings and imports back the same deck', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Round trip', 'modern', {
      text: '4 Lightning Bolt (FDC) 163\n2 Counterspell (FDC) 61\n\nSideboard\n1 Shivan Dragon (FDN) 763\n\nMaybeboard\n1 Sol Ring (C21) 263',
    })
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Export')
    // Automatic categories export as tags (spec 022, AC-1).
    const expected = 'Deck\n2 Counterspell (FDC) 61 #Counterspell\n4 Lightning Bolt (FDC) 163 #Removal #Burn\n\nSideboard\n1 Shivan Dragon (FDN) 763 #Evasion\n\nMaybeboard\n1 Sol Ring (C21) 263 #Ramp\n'
    await expect(page.getByTestId('export-text')).toHaveValue(expected)

    const copy = await api.deck('Copy', 'modern', { text: expected })
    const exported = await api.get(`/api/decks/${copy.id}/export/`)
    expect(exported.text).toBe(expected)
  })

  test('AC-28: public decks show on the profile and in the directory, without locations', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Shared', 'commander', {
      is_public: true, create_box: true, text: 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Sol Ring\n1 Forest',
    })
    const hidden = await api.deck('Secret', 'casual', { text: '1 Sol Ring' })
    const binder = await api.location('Private binder')
    await api.importList('1 Sol Ring (C21) 263', binder)
    await api.importList('1 Forest (M21) 272', deck.location)
    // The box is public with its deck but counts once, as the deck (spec 005, AC-20).

    await logOut(page)
    const visitor = uniqueUser('v')
    await createUser(request, visitor)
    await page.goto('/users')
    await page.getByLabel('Search users').fill(user.username)
    await expect(page.getByTestId('directory')).toHaveText(`${user.username}1 public deck`)
    await page.goto(`/u/${user.username}`)
    const tiles = page.getByTestId('profile-decks').getByTestId('deck-tile')
    await expect(tiles).toHaveCount(1)
    await tiles.getByRole('link', { name: 'Shared' }).click()

    await expect(page).toHaveURL(new RegExp(`/u/${user.username}/decks/${deck.id}$`))
    await expect(page.getByTestId('deck-name')).toHaveText('Shared')
    await expect(page.getByRole('tab')).toHaveText(['Deck', 'Swaps', 'Combos', 'Stats']) // Combos: spec 022, AC-6; no Simulate tab: spec 025, AC-2
    await expect(page.getByTestId('deck-box')).toHaveAttribute('href', `/u/${user.username}/locations/${deck.location}`)
    await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
    await expect(deckRow(page, 'Forest').getByTestId('ownership')).toHaveAttribute('data-state', 'in_box')
    await expect(deckRow(page, 'Sol Ring').getByTestId('ownership')).toHaveAttribute('data-state', 'owned')

    await deckRow(page, 'Sol Ring').click()
    const dialog = page.getByTestId('card-detail')
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('Free in collection')
    await expect(dialog).not.toContainText('Private binder')
    await expect(dialog.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await closeCardDialog(page)
    await page.getByRole('tab', { name: 'Stats' }).click()
    await expect(page.getByTestId('deck-stats')).toBeVisible()

    await page.goto(`/u/${user.username}/decks/${hidden.id}`)
    await expect(page.getByText('Deck not found')).toBeVisible()
  })
})
