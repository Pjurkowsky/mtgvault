import { expect, test } from '@playwright/test'
import { cardDialog, choose, deckRow, signUpAndLogIn } from './helpers'

// Spec 005: Text, List and Images views, card menus, remembered options (AC-6 to AC-8).
const LIST = 'Deck\n1 Lightning Bolt\n1 Counterspell\n1 Shivan Dragon\n2 Forest'

test.describe('Deck views', () => {
  test('AC-6: Text by default with the image beside the hovered line; List and Images', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Views', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('deck-text')).toBeVisible()
    await expect(page.getByTestId('group-main-Lands')).toContainText('Lands (2)')
    await deckRow(page, 'Shivan Dragon').hover()
    await expect(page.getByTestId('card-preview')).toHaveAttribute('alt', 'Shivan Dragon')
    await deckRow(page, 'Shivan Dragon').click()
    await expect(cardDialog(page)).toContainText('Shivan Dragon')
    await cardDialog(page).getByRole('button', { name: 'Close' }).last().click()

    await page.getByRole('button', { name: 'List', exact: true }).click()
    await expect(page.getByTestId('deck-list')).toBeVisible()
    await page.getByRole('button', { name: 'Card images' }).click()
    await expect(page.getByTestId('deck-visual')).toBeVisible()
  })

  test('AC-7: right-click opens Edit, Propose swap and Delete in every view', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Menus', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    const menu = page.getByRole('menu')

    await deckRow(page, 'Counterspell').click({ button: 'right' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Edit', 'Propose swap', 'Add to want list', 'Delete'])
    await menu.getByRole('menuitem', { name: 'Edit' }).click()
    await expect(cardDialog(page).getByTestId('deck-section')).toBeVisible()
    await cardDialog(page).getByRole('button', { name: 'Close' }).last().click()

    await page.getByRole('button', { name: 'List', exact: true }).click()
    await deckRow(page, 'Counterspell').click({ button: 'right' })
    await menu.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Removed Counterspell.')).toBeVisible()
    await expect(deckRow(page, 'Counterspell')).toHaveCount(0)

    await page.getByRole('button', { name: 'Card images' }).click()
    await page.getByTestId('deck-visual').getByRole('button', { name: 'Forest', exact: true }).click({ button: 'right' })
    await expect(menu.getByRole('menuitem')).toHaveText(['Edit', 'Propose swap', 'Add to want list', 'Delete'])
    await page.keyboard.press('Escape')
    // Delete removes the card from the deck only.
    expect((await api.get(`/api/decks/${deck.id}/`)).cards).toHaveLength(3)
  })

  test('AC-8: view, grouping and sort are remembered for all decks; the URL wins', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('One', 'casual', { text: LIST })
    const other = await api.deck('Two', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await choose(page, 'Group by', 'By color')
    await choose(page, 'Sort by', 'Mana value')
    await page.getByRole('button', { name: 'List', exact: true }).click()

    await page.goto(`/decks/${other.id}`)
    await expect(page.getByTestId('deck-list')).toBeVisible()
    await expect(page.getByTestId('group-main-Red')).toContainText('Lightning Bolt')
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveText('Mana value')

    await page.goto(`/decks/${other.id}?group=type&layout=text`)
    await expect(page.getByTestId('deck-text')).toBeVisible()
    await expect(page.getByTestId('group-main-Instants')).toBeVisible()

    // Without storage the defaults apply.
    await page.evaluate(() => localStorage.clear())
    await page.goto(`/decks/${other.id}`)
    await expect(page.getByTestId('deck-text')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveText('By type')
  })
})
