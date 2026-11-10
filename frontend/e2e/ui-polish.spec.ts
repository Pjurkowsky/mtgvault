import { expect, test, type Page } from '@playwright/test'
import { deckRow, signUpAndLogIn } from './helpers'

// Spec 023: UI polish. Krenko makes a Goblin; Dockside and Smothering Tithe make a Treasure.
const LIST = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Dockside Extortionist\n1 Sol Ring\n\nMaybeboard\n1 Smothering Tithe'
const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!

test.describe('UI polish', () => {
  test('AC-1, AC-2: the toolbar is one left block; the keys show on the search box', async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Toolbar', 'commander', { text: LIST })
    await page.goto(`/decks/${deck.id}`)

    // The view toggle sits right after the other controls, far from the right edge.
    const toolbar = await box(page, 'deck-toolbar')
    const toggle = (await page.getByRole('button', { name: 'Card images' }).boundingBox())!
    expect(toolbar.x + toolbar.width - (toggle.x + toggle.width)).toBeGreaterThan(200)

    await expect(page.getByTestId('deck-toolbar').getByRole('button', { name: /Escape clears/ })).toHaveCount(0) // no ⓘ icon
    await page.getByTestId('deck-search').hover()
    await expect(page.getByTestId('search-keys')).toContainText('Escape')
    await page.mouse.move(0, 0)
    await expect(page.getByTestId('search-keys')).toHaveCount(0)
    await page.getByTestId('deck-search').locator('input').focus()
    await expect(page.getByTestId('search-keys')).toBeVisible()
  })

  test('AC-3: tokens are a group after Maybeboard in every view, names only', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tokens', 'casual', { text: 'Deck\n1 Dockside Extortionist\n1 Sol Ring\n\nMaybeboard\n1 Krenko, Mob Boss' })

    for (const layout of ['text', 'list', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      const tokens = page.getByTestId('deck-tokens')
      await expect(tokens.getByRole('heading')).toHaveText('Tokens (1)')
      // Inside the view's own column flow, after Maybeboard.
      await expect(page.getByTestId(`deck-${layout}`).getByTestId('deck-tokens')).toHaveCount(1)
      const groups = await page.getByTestId(`deck-${layout}`).locator(':scope > section').evaluateAll((s) => s.map((e) => e.getAttribute('data-testid')))
      expect(groups.at(-1)).toBe('deck-tokens')
      expect(groups.at(-2)).toBe('group-maybe')
      if (layout !== 'visual') await expect(tokens.getByTestId('token-row')).toHaveText('Treasure')
    }

    await page.getByTestId('deck-tokens').getByRole('button', { name: 'Treasure' }).click()
    await expect(page.getByTestId('token-makers')).toContainText('Dockside Extortionist')
  })

  test('AC-4: List view lists the commander first; the side column only previews', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Krenko', 'commander', { text: LIST })

    await page.goto(`/decks/${deck.id}?layout=list`)
    const groups = page.getByTestId('deck-list').locator(':scope > section')
    await expect(groups.first()).toHaveAttribute('data-testid', 'group-commander')
    await expect(groups.first().getByRole('heading')).toContainText('Commander (1)')
    await expect(groups.first()).toContainText('Krenko, Mob Boss')
    await expect(page.getByTestId('deck-commander')).toHaveCount(0)
    await deckRow(page, 'Sol Ring').hover()
    await expect(page.getByTestId('deck-preview')).toHaveAttribute('alt', 'Sol Ring')

    for (const layout of ['text', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      await expect(page.getByTestId('deck-commander').getByRole('button', { name: 'Krenko, Mob Boss' })).toBeVisible()
      await expect(page.getByTestId('group-commander')).toHaveCount(0)
    }
  })
})
