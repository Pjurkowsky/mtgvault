import { expect, test, type Page } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 015: deck tokens (AC-1 to AC-8). Fixture: Dockside Extortionist (2X2) and
// Smothering Tithe (CMM) make a Treasure (T2X2 #22, TCMM #48); Krenko, Mob Boss makes a Goblin.
const LIST = 'Deck\n1 Dockside Extortionist (2X2) 107\n1 Smothering Tithe (CMM) 57\n1 Lightning Bolt (FDC) 163\n\nMaybeboard\n1 Krenko, Mob Boss (FDN) 204'
const group = (page: Page) => page.getByTestId('deck-tokens')

test.describe('Deck tokens', () => {
  test('AC-1: tokens never show in card search', async ({ request, page }) => {
    const { api } = await signUpAndLogIn(page, request)
    expect((await api.get('/api/catalog/cards/?q=Treasure')) as unknown[]).toEqual([])
    expect(((await api.get('/api/catalog/cards/?q=Dockside')) as { name: string }[]).map((c) => c.name)).toEqual(['Dockside Extortionist'])
  })

  test('AC-2 to AC-4, AC-6: one tile per kind in every view, makers on hover, filters narrow it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Treasures', 'casual', { text: LIST })
    const detail = await api.get(`/api/decks/${deck.id}/`)
    expect(detail.tokens.map((t: { name: string; set_code: string }) => [t.name, t.set_code])).toEqual([['Treasure', 't2x2']]) // Maybeboard Krenko adds nothing
    expect(detail.counts.size).toBe(3) // AC-6

    for (const layout of ['text', 'list', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      await expect(group(page).getByRole('heading')).toHaveText('Tokens (1)')
      await expect(group(page).getByTestId('token')).toHaveCount(1)
    }

    // Spec 021, AC-9: the makers moved from the hover into the Token dialog.
    const treasure = group(page).getByRole('button', { name: 'Treasure' })
    await treasure.click()
    await expect(page.getByTestId('token-makers')).toContainText('Dockside Extortionist')
    await expect(page.getByTestId('token-makers')).toContainText('Smothering Tithe')
    await page.keyboard.press('Escape')

    // AC-4: tokens of the cards shown.
    await page.goto(`/decks/${deck.id}?q=Tithe`)
    await expect(page.getByTestId('deck-tokens').getByRole('button', { name: 'Treasure' })).toBeVisible()
    await page.goto(`/decks/${deck.id}?q=Bolt`)
    await expect(deckRow(page, 'Lightning Bolt')).toBeVisible()
    await expect(group(page)).toHaveCount(0)
  })

  test('AC-5, AC-7: visitors see tokens; the card dialog lists a card\'s tokens', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Goblins', 'casual', { is_public: true, text: 'Deck\n1 Krenko, Mob Boss (FDN) 204' })
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await expect(group(page).getByRole('button', { name: 'Goblin' })).toBeVisible()

    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Krenko, Mob Boss').click()
    await expect(cardDialog(page).getByTestId('card-tokens').getByRole('button', { name: 'Goblin' })).toBeVisible()
  })

  test('AC-8: deck Export adds a Tokens section when ticked', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Export', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Export', exact: true }).click()
    const text = page.getByTestId('export-text')
    const tokens = page.getByTestId('export-options').getByRole('checkbox', { name: 'Tokens' })
    await expect(tokens).not.toBeChecked()
    await expect(text).not.toHaveValue(/Tokens/)
    await tokens.click()
    await expect(text).toHaveValue(/\n\nTokens\n1 Treasure \(T2X2\) 22\n$/)
    await page.getByTestId('export-options').getByRole('checkbox', { name: 'Printings' }).click()
    await expect(text).toHaveValue(/\n\nTokens\n1 Treasure\n$/)
  })
})
