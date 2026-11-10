import { expect, test } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn, tile } from './helpers'

// Spec 021: the card dialog's price line, separators and ownership said once (AC-20 to AC-22).
test.describe('Card dialog polish', () => {
  test('AC-20: a price under the image in every card dialog, following the reprint', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    const deck = await api.deck('Price', 'casual', { text: 'Deck\n1 Sol Ring (C21) 263' })

    // A collection copy: its price.
    await page.goto('/locations/unfiled?view=grid')
    await tile(page, 'Sol Ring').click()
    const price = cardDialog(page).getByTestId('detail-image-price')
    await expect(price).toHaveText(await cardDialog(page).getByTestId('detail-price').innerText())
    await page.keyboard.press('Escape')

    // A deck card: the price the deck counts.
    await page.goto(`/decks/${deck.id}`)
    const sol = (await api.get(`/api/decks/${deck.id}/`)).cards[0]
    await deckRow(page, 'Sol Ring').click()
    await expect(price).toHaveText(`€${sol.price.toFixed(2)}`)
    // An EDHREC card (no copy, not in the deck): its printing's price.
    await cardDialog(page).getByRole('tab', { name: 'Played with' }).click()
    await page.getByTestId('edhrec-played-with').getByRole('button', { name: 'Rhystic Study', exact: true }).click()
    await expect(cardDialog(page).getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()
    const rhystic = (await api.get('/api/catalog/cards/?q=Rhystic'))[0]
    const printing = (await api.get(`/api/catalog/cards/${rhystic.oracle_id}/printings/`))[0]
    const eur = printing.prices.nonfoil ?? printing.prices.foil
    await expect(price).toHaveText(eur === null ? '–' : `€${Number(eur).toFixed(2)}`)
  })

  test('AC-21, AC-22: separators between sections; ownership said once, tooltip on screen', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Once', 'casual', { text: 'Deck\n2 Lightning Bolt' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Lightning Bolt').click()
    const dialog = cardDialog(page)
    // Left: image | reprints; right: deck section | EDHREC tabs; deck section: ownership | fields | buttons.
    const section = dialog.getByTestId('deck-section')
    expect(await section.locator('[data-orientation="horizontal"]').count()).toBeGreaterThanOrEqual(2)
    expect(await dialog.locator('[data-orientation="horizontal"]').count()).toBeGreaterThanOrEqual(5)

    await expect(dialog.getByTestId('ownership-label')).toHaveText('Missing 2 of 2')
    await expect(dialog.getByTestId('deck-card-ownership').getByText(/missing/i)).toHaveCount(1)

    const label = dialog.getByTestId('ownership-label')
    const tip = page.getByText('Missing · needs 2').filter({ visible: true }).locator('..')
    // Hover again until the tooltip opens: the dialog may still be animating in.
    await expect(async () => {
      await page.mouse.move(5, 5)
      await label.hover()
      await expect(tip).toBeVisible({ timeout: 1500 })
    }).toPass()
    const box = (await tip.boundingBox())!
    // Next to the label, not at the far edge of the row.
    const at = (await label.boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - (at.x + at.width / 2))).toBeLessThan(120)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1280)
    expect(box.y + box.height).toBeLessThanOrEqual(800)
  })
})
