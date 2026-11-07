import { expect, test, type Page } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 010: the want list from decks (AC-2, AC-4, AC-14 to AC-17).
const LIST = 'Deck\n1 Counterspell\n2 Forest\n1 Sol Ring'
const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text })

test.describe('Want list from decks', () => {
  test('AC-14 to AC-16: missing cards onto the want list, one or all, without doubles; a heart marks them', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    const deck = await api.deck('Wants', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await expect(deckRow(page, 'Counterspell').getByTestId('wanted')).toHaveCount(0)

    await deckRow(page, 'Counterspell').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Add to want list' }).click()
    await expect(toast(page, 'Added 1 card to the want list.')).toBeVisible()
    await expect(deckRow(page, 'Counterspell').getByTestId('wanted')).toBeVisible()
    await expect(deckRow(page, 'Counterspell').getByTestId('ownership')).toHaveAttribute('data-state', 'missing')

    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Add missing to want list' }).click()
    await expect(toast(page, 'Added 2 cards to the want list.')).toBeVisible() // the two Forests
    await expect(deckRow(page, 'Forest').getByTestId('wanted')).toBeVisible()
    await expect(deckRow(page, 'Sol Ring').getByTestId('wanted')).toHaveCount(0)

    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Add missing to want list' }).click()
    await expect(toast(page, 'Nothing is missing from the want list.')).toBeVisible()

    const wants = (await api.get('/api/wants/')).results
    expect(wants.map((w: { printing: { name: string }; quantity: number; deck_name: string }) => [w.printing.name, w.quantity, w.deck_name]).sort())
      .toEqual([['Counterspell', 1, 'Wants'], ['Forest', 2, 'Wants']])

    // The deck filter on the want list (AC-8).
    const other = await api.deck('Other', 'casual', { text: 'Deck\n1 Shivan Dragon' })
    await api.post(`/api/decks/${other.id}/want-missing/`, {})
    await page.goto(`/wants?deck=${deck.id}`)
    await expect(page.getByTestId('card-tile')).toHaveCount(2)
    await page.goto(`/wants?deck=${other.id}`)
    await expect(page.getByTestId('card-tile')).toHaveCount(1)
  })

  test('AC-2, AC-4: from a deck card dialog, Add goes into the deck and the want list links the deck', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Ramp', 'casual', { text: 'Deck\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Sol Ring').click()
    await cardDialog(page).getByRole('tab', { name: 'Played with' }).click()
    await page.getByTestId('edhrec-played-with').getByRole('button', { name: 'Rhystic Study', exact: true }).click()
    await expect(cardDialog(page).getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()

    await cardDialog(page).getByTestId('add-want').click()
    await expect(cardDialog(page).getByTestId('add-want')).toHaveText('Add to want list (1)')
    expect((await api.get('/api/wants/')).results[0]).toMatchObject({ deck: deck.id, deck_name: 'Ramp' })

    await cardDialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    const add = page.getByRole('dialog', { name: 'Add Rhystic Study to Ramp' })
    await expect(add.getByLabel('Card name')).toHaveCount(0)
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(toast(page, 'Added 1 × Rhystic Study to Mainboard.')).toBeVisible()
    await expect(add).toHaveCount(0)
    await expect(deckRow(page, 'Rhystic Study')).toBeVisible()
  })

  test('AC-17: deleting a deck keeps its want list entries, without a deck, merged', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Gone', 'casual', { text: 'Deck\n2 Counterspell' })
    await api.post(`/api/decks/${deck.id}/want-missing/`, {})
    const counterspell = (await api.get('/api/wants/')).results[0].printing.id
    await api.post('/api/wants/', { printing: counterspell })
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete deck' }).click()
    await expect(page).toHaveURL(/\/decks$/)
    const wants = (await api.get('/api/wants/')).results
    expect(wants).toHaveLength(1)
    expect(wants[0]).toMatchObject({ quantity: 3, deck: null })
  })
})
