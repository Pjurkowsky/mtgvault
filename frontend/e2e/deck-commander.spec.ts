import { expect, test } from '@playwright/test'
import { cardDialog, closeCardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 021: commander showcase and the side column (AC-5 to AC-7).
const LIST = 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Lightning Bolt\n1 Counterspell\n1 Shivan Dragon\n1 Sol Ring'

test.describe('Deck commander', () => {
  test('AC-5, AC-6: the commander sits in a sticky left column, out of the groups, whatever the filters', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Piper', 'commander', { text: LIST })
    const showcase = page.getByTestId('deck-commander')
    const piper = showcase.getByRole('button', { name: 'The Prismatic Piper' })

    for (const layout of ['text', 'list', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      await expect(piper).toBeVisible()
      await expect(page.getByTestId('group-commander')).toHaveCount(0)
      await expect(page.locator('main [data-testid^="group-"]').filter({ hasText: 'The Prismatic Piper' })).toHaveCount(0)
      // Left of the cards.
      const side = (await page.getByTestId('deck-side').boundingBox())!
      const cards = (await page.getByTestId(`deck-${layout}`).boundingBox())!
      expect(side.x + side.width).toBeLessThan(cards.x)
      expect(side.width).toBe(256)
    }

    // Sticky: it stays in view while the page scrolls.
    await page.setViewportSize({ width: 1400, height: 500 })
    await page.goto(`/decks/${deck.id}?layout=visual`)
    await page.mouse.wheel(0, 600)
    await expect(piper).toBeInViewport()

    // Filters never hide it.
    await page.goto(`/decks/${deck.id}?q=Bolt`)
    await expect(deckRow(page, 'Lightning Bolt')).toBeVisible()
    await expect(piper).toBeVisible()

    // Click opens the card dialog; right-click opens the card menu.
    await piper.click()
    await expect(cardDialog(page)).toContainText('The Prismatic Piper')
    await closeCardDialog(page)
    await piper.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Narrow: above the cards.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/decks/${deck.id}`)
    const side = (await showcase.boundingBox())!
    const text = (await page.getByTestId('deck-text').boundingBox())!
    expect(side.y + side.height).toBeLessThanOrEqual(text.y)
  })

  test('AC-7: List view previews below the commander; without one, only List view has the column', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Piper', 'commander', { text: LIST })
    await page.goto(`/decks/${deck.id}?layout=list`)
    await deckRow(page, 'Shivan Dragon').hover()
    const preview = page.getByTestId('deck-preview')
    await expect(preview).toHaveAttribute('alt', 'Shivan Dragon')
    expect((await preview.boundingBox())!.y).toBeGreaterThan((await page.getByTestId('deck-commander').boundingBox())!.y)
    await expect(page.getByTestId('deck-list').getByAltText('Shivan Dragon')).toHaveCount(0) // no image column inside the list

    const plain = await api.deck('Plain', 'casual', { text: 'Deck\n1 Lightning Bolt\n1 Sol Ring' })
    await page.goto(`/decks/${plain.id}?layout=list`)
    await expect(page.getByTestId('deck-side')).toBeVisible()
    await page.goto(`/decks/${plain.id}?layout=text`)
    await expect(page.getByTestId('deck-side')).toHaveCount(0)
    const text = (await page.getByTestId('deck-text').boundingBox())!
    expect(text.x).toBeLessThan(40)
  })
})
