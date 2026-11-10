import { expect, test } from '@playwright/test'
import { cardDialog, choose, closeCardDialog, deckMenu, deckRow, signUpAndLogIn } from './helpers'

// Spec 006: your own categories on deck cards (AC-12 to AC-15).
test.describe('Deck categories', () => {
  test('AC-12 to AC-14: edit in the card dialog and the menu, suggestions, group by category, filter', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    // Cards with no automatic category, so the test starts from none (spec 022, AC-1).
    const deck = await api.deck('Tags', 'casual', { text: '1 Thoughtseize\n1 Giant Growth\n1 Temur Sabertooth\n1 Forest' })
    await page.goto(`/decks/${deck.id}`)

    await deckRow(page, 'Thoughtseize').click()
    const input = cardDialog(page).getByTestId('category-input')
    await input.getByRole('button', { name: '+ Ramp' }).click() // a common suggestion
    await input.getByLabel('Add category').fill('Artifacts')
    await input.getByLabel('Add category').press('Enter')
    await expect(input.getByTestId('category-chip')).toHaveText(['Ramp', 'Artifacts'])
    await closeCardDialog(page)

    await deckRow(page, 'Giant Growth').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Categories…' }).click()
    const quick = page.getByTestId('category-dialog')
    await expect(quick.getByRole('button', { name: '+ Artifacts' })).toBeVisible() // used in your decks
    await quick.getByRole('button', { name: '+ Ramp' }).click()
    await expect(quick.getByTestId('category-chip')).toHaveText(['Ramp'])
    await page.keyboard.press('Escape')

    await choose(page, 'Group by', 'By category')
    await expect(page.getByTestId('group-main-Ramp')).toContainText('Ramp (2)')
    await expect(page.getByTestId('group-main-Ramp')).toContainText('Thoughtseize')
    await expect(page.getByTestId('group-main-Artifacts')).toHaveCount(0) // only the primary one groups
    await expect(page.getByTestId('group-main-Creatures')).toContainText('Temur Sabertooth')

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByTestId('filter-panel').locator('label').filter({ hasText: 'Artifacts' }).getByRole('checkbox').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('deck-row')).toHaveText([/Thoughtseize/])

    // Remove a category with its chip.
    await deckRow(page, 'Thoughtseize').click()
    await input.getByRole('button', { name: 'Remove Ramp' }).click()
    await expect(input.getByTestId('category-chip')).toHaveText(['Artifacts'])
  })

  test('AC-15: export writes #tags and import reads them back', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tagged', 'casual', { text: '1 Sol Ring (C21) 263 #Ramp #Mana_rock\n1 Forest (M21) 272' })
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Export')
    await expect(page.getByTestId('export-text')).toHaveValue('Deck\n1 Forest (M21) 272\n1 Sol Ring (C21) 263 #Ramp #Mana_rock\n')
    await page.keyboard.press('Escape')
    await deckRow(page, 'Sol Ring').click()
    await expect(cardDialog(page).getByTestId('category-chip')).toHaveText(['Ramp', 'Mana rock'])
  })
})
