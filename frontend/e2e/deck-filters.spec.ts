import { expect, test } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 006: search, filters, the ownership filter and keyboard on the Deck tab (AC-5 to AC-9).
const LIST = 'Deck\n2 Lightning Bolt\n1 Counterspell\n1 Shivan Dragon\n1 Sol Ring\n3 Forest'

test.describe('Deck search and filters', () => {
  test('AC-5 to AC-7: search and filters narrow every view, counts follow, the URL keeps them', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Filters', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await page.getByLabel('Search deck').fill('bolt')
    await expect(page.getByTestId('deck-row')).toHaveCount(1)
    await expect(page.getByTestId('group-main-Instants')).toContainText('Instants (2)')
    await expect(page).toHaveURL(/q=bolt/)
    await page.getByLabel('Search deck').fill('')
    await expect(page.getByTestId('deck-row')).toHaveCount(5)

    await page.getByRole('button', { name: 'Filters' }).click()
    const panel = page.getByTestId('filter-panel')
    await panel.getByRole('button', { name: 'Red' }).click()
    await expect(page.getByTestId('deck-row')).toHaveCount(2) // Lightning Bolt and Shivan Dragon
    await panel.getByText('Mana value').waitFor()
    await panel.locator('label').filter({ hasText: /^1$/ }).getByRole('checkbox').click()
    await expect(page.getByTestId('deck-row')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Filters' })).toContainText('2')
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(page.getByTestId('deck-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'Card images' }).click()
    await expect(page.getByTestId('deck-visual').getByRole('button', { name: 'Lightning Bolt', exact: true })).toBeVisible()
    await expect(page.getByTestId('deck-visual').getByRole('button', { name: 'Sol Ring', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Filters' }).click()
    await panel.getByRole('button', { name: 'Clear' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('deck-visual').getByRole('button', { name: 'Sol Ring', exact: true })).toBeVisible()
  })

  test('AC-6, AC-8: the ownership filter replaces the Owned and Missing tabs; Export missing in the menu', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263\n1 Forest (M21) 272')
    const deck = await api.deck('Own', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByRole('tab')).toHaveText(['Deck', 'Swaps', 'Combos', 'Stats']) // Combos: spec 022, AC-6

    await page.getByRole('button', { name: 'Filters' }).click()
    // Spec 012: free copies are Free in collection; Owned is what's in the deck box.
    const panel = page.getByTestId('filter-panel')
    for (const name of ['Owned', 'Free in collection', 'In other decks', 'Missing']) await expect(panel.getByText(name, { exact: true })).toBeVisible()
    await expect(panel.getByText('In deck box')).toHaveCount(0)
    await panel.locator('label').filter({ hasText: 'Free in collection' }).getByRole('checkbox').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('deck-row')).toHaveText([/Sol Ring/])
    await expect(deckRow(page, 'Sol Ring').getByTestId('ownership')).toContainText('Free in collection')
    await page.goto(`/decks/${deck.id}?own=missing`)
    await expect(page.getByTestId('deck-row')).toHaveCount(4) // Forest is short 2 copies

    await deckRow(page, 'Counterspell').click({ button: 'right' })
    // It works now (spec 010, AC-15; deck-wants.spec.ts).
    await expect(page.getByRole('menuitem', { name: 'Add to want list' })).not.toHaveAttribute('data-disabled', '')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Export missing' }).click()
    await expect(page.getByTestId('export-text')).toHaveValue(/2 Forest/)
    await expect(page.getByTestId('export-text')).not.toHaveValue(/Sol Ring/)
  })

  test('AC-9: / focuses the search, Escape clears it, arrows move between cards, Enter opens', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Keys', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await page.getByTestId('deck-name').click()
    await page.keyboard.press('/')
    await expect(page.getByLabel('Search deck')).toBeFocused()
    await page.keyboard.type('sol')
    await expect(page.getByTestId('deck-row')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('deck-row')).toHaveCount(5)

    // Text view: Creatures | Instants | Artifacts and Lands side by side.
    await deckRow(page, 'Counterspell').focus()
    await page.keyboard.press('ArrowDown')
    await expect(deckRow(page, 'Lightning Bolt')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(deckRow(page, 'Counterspell')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(deckRow(page, 'Sol Ring')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(deckRow(page, 'Shivan Dragon')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(cardDialog(page)).toContainText('Shivan Dragon')
  })
})
