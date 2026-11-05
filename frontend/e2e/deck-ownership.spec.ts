import { expect, test } from '@playwright/test'
import { cardDialog, closeCardDialog, deckRow, signUpAndLogIn, tile } from './helpers'

const state = (page: import('@playwright/test').Page, name: string) => deckRow(page, name).getByTestId('ownership')

test.describe('Deck ownership', () => {
  test('AC-13, AC-14: four states; the Maybeboard counts toward no totals', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const other = await api.deck('Other', 'casual', { create_box: true, text: '1 Sol Ring' })
    await api.importList('1 Sol Ring (C21) 263', other.location)
    const deck = await api.deck('Mine', 'casual', {
      create_box: true, text: '2 Lightning Bolt\n1 Counterspell\n1 Sol Ring\n4 Forest\n\nMaybeboard\n1 Brainstorm',
    })
    await api.importList('2 Lightning Bolt (FDC) 163', deck.location)
    await api.importList('1 Counterspell (FDC) 61\n1 Forest (M21) 272')

    await page.goto(`/decks/${deck.id}`)
    await expect(state(page, 'Lightning Bolt')).toHaveAttribute('data-state', 'in_box')
    await expect(state(page, 'Counterspell')).toHaveAttribute('data-state', 'owned')
    await expect(state(page, 'Sol Ring')).toHaveAttribute('data-state', 'other_decks')
    await expect(state(page, 'Forest')).toHaveAttribute('data-state', 'missing')
    await expect(state(page, 'Brainstorm')).toHaveAttribute('data-state', 'missing')

    await deckRow(page, 'Sol Ring').click()
    const dialog = cardDialog(page)
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('In other decks')
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in deck Other')
    await closeCardDialog(page)
    await deckRow(page, 'Forest').click()
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in Unfiled')
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('3 missing')
    await closeCardDialog(page)

    // 2 Bolt + 1 Counterspell + 1 Forest owned; 1 Sol Ring + 3 Forest missing. Brainstorm doesn't count.
    expect((await api.get(`/api/decks/${deck.id}/`)).counts).toMatchObject({ owned: 4, missing: 4 })
  })

  test('AC-15: mark owned by moving a free copy or adding a new one', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Boxed', 'casual', { create_box: true, text: '1 Counterspell\n1 Forest' })
    await api.importList('1 Counterspell (SLD) 7117')
    await page.goto(`/decks/${deck.id}`)
    const dialog = cardDialog(page)

    await deckRow(page, 'Counterspell').click()
    await dialog.getByRole('button', { name: 'Move to deck box' }).click()
    await expect(page.getByText('Moved into the deck box.')).toBeVisible()
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in Boxed')
    await closeCardDialog(page)
    await expect(state(page, 'Counterspell')).toHaveAttribute('data-state', 'in_box')

    // A new copy uses the collection's add fields, starting on the deck box (spec 005, AC-4).
    await deckRow(page, 'Forest').click()
    await dialog.getByRole('button', { name: 'Add a new copy to the deck box' }).click()
    const add = page.getByRole('dialog').last()
    await expect(add.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Boxed' })).toHaveAttribute('data-state', 'on')
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Forest.')).toBeVisible()
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in Boxed')
    await closeCardDialog(page)
    await expect(state(page, 'Forest')).toHaveAttribute('data-state', 'in_box')

    await page.getByTestId('deck-box').click()
    await expect(tile(page, 'Counterspell')).toBeVisible()
    await expect(tile(page, 'Forest')).toBeVisible()
  })

  test('AC-15: without a deck box a new copy needs a location', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Loose', 'casual', { text: '1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Sol Ring').click()
    const dialog = cardDialog(page)
    await expect(dialog.getByRole('button', { name: 'Move to deck box' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Add a new copy' }).click()
    const add = page.getByRole('dialog').last()
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(add).toContainText('Choose a location')
    await add.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Unfiled' }).click()
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Sol Ring.')).toBeVisible()
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in Unfiled')
    await closeCardDialog(page)
    await expect(state(page, 'Sol Ring')).toHaveAttribute('data-state', 'owned')
  })
})
