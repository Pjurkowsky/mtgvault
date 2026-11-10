import { expect, test } from '@playwright/test'
import { cardDialog, signUpAndLogIn } from './helpers'

// Spec 006: the Stats tab (AC-16 to AC-18).
const LIST = [
  '4 Lightning Bolt (FDC) 163',
  '2 Counterspell (FDC) 61',
  '1 Shivan Dragon (FDN) 763',
  '1 Llanowar Elves (FDC) 213',
  '20 Forest',
  '',
  'Sideboard',
  '1 Sol Ring (C21) 263',
  '',
  'Maybeboard',
  '1 Counterspell (SLD) 7117', // the priciest card, but the Maybeboard doesn't count
].join('\n')

test.describe('Deck stats', () => {
  test('AC-16, AC-18: key numbers and charts count the Commander, Mainboard and Sideboard', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Stats', 'casual', { text: LIST })
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards
    const bolt = cards.find((c: { printing: { name: string } }) => c.printing.name === 'Lightning Bolt')
    await api.patch(`/api/decks/${deck.id}/cards/${bolt.id}/`, { categories: ['Removal'] })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/decks/${deck.id}?tab=stats`)

    await expect(page.getByTestId('stat-cards')).toContainText('29')
    await expect(page.getByTestId('stat-lands')).toContainText('20')
    // (4×1 + 2×2 + 6 + 1 + 1) / 9 nonland cards; / 29 with lands
    await expect(page.getByTestId('average-mv')).toContainText('1.78')
    await expect(page.getByTestId('average-mv')).toContainText('0.55 with lands')
    await expect(page.getByTestId('stat-value')).toBeVisible()
    await expect(page.getByTestId('stat-missing')).toContainText('To buy')

    const curve = page.getByTestId('mana-curve')
    await expect(curve.locator('[data-mv="1"]')).toHaveAccessibleName('Mana value 1: 1 creatures, 5 other spells')
    await expect(curve.locator('[data-mv="2"]')).toHaveAccessibleName('Mana value 2: 0 creatures, 2 other spells')
    await expect(curve.locator('[data-mv="6"]')).toHaveAccessibleName('Mana value 6: 1 creatures, 0 other spells')

    // Symbols: blue 4, red 6, green 1. Sources: Forest and Elves make green, Sol Ring colorless.
    const colors = page.getByTestId('colors').getByRole('button')
    await expect(colors).toHaveCount(4)
    await expect(page.getByTestId('colors').locator('[data-color="R"]')).toHaveAccessibleName('Show Red: 55% of symbols, 0% of sources')
    await expect(page.getByTestId('colors').locator('[data-color="G"]')).toHaveAccessibleName('Show Green: 9% of symbols, 95% of sources')
    await expect(page.getByTestId('colors').locator('[data-color="C"]')).toHaveAccessibleName('Show Colorless: 0% of symbols, 5% of sources')

    await expect(page.getByTestId('types').getByTestId('stat-bar')).toHaveText(['Creature2', 'Instant6', 'Artifact1', 'Land20'])
    await expect(page.getByTestId('rarities').getByTestId('stat-bar')).toHaveText(['Common21', 'Uncommon8'])
    // Automatic categories count too (spec 022, AC-1).
    await expect(page.getByTestId('categories').getByTestId('stat-bar')).toHaveText(['Removal4', 'Counterspell2', 'Ramp2', 'Evasion1'])
    await expect(page.getByTestId('sets').getByTestId('stat-bar').first()).toContainText('20')

    const expensive = page.getByTestId('expensive-card')
    await expect(expensive.first()).toContainText('Counterspell')
    await expect(expensive.nth(1)).toContainText('Lightning Bolt')
    await expect(expensive).toHaveCount(6)

    // Two columns on wide screens, one on phones.
    const top = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await top('types')).toBe(await top('rarities'))
    await page.screenshot({ path: 'test-results/deck-stats-wide.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 900 })
    expect(await top('rarities')).toBeGreaterThan(await top('types'))

    await expensive.first().click()
    await expect(cardDialog(page)).toContainText('Counterspell')
  })

  test('AC-17: a chart click opens the Deck tab with only that filter', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Clicks', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}?tab=stats&rarity=common&q=forest`)

    await page.getByTestId('mana-curve').locator('[data-mv="1"]').click()
    await expect(page.getByRole('tab', { name: 'Deck' })).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/[?&]mv=1(&|$)/)
    await expect(page).not.toHaveURL(/rarity|q=|tab=/)
    await expect(page.getByTestId('deck-row')).toHaveText([/Llanowar Elves/, /Lightning Bolt/, /Sol Ring/]) // grouped by type, Sideboard last

    await page.getByRole('tab', { name: 'Stats' }).click()
    await page.getByTestId('types').getByRole('button', { name: /^Show Creature/ }).click()
    await expect(page).not.toHaveURL(/mv=/)
    await expect(page.getByTestId('deck-row')).toHaveText([/Llanowar Elves/, /Shivan Dragon/])

    await page.getByRole('tab', { name: 'Stats' }).click()
    await page.getByTestId('colors').locator('[data-color="G"]').click()
    await expect(page).toHaveURL(/color=G/)
    await expect(page.getByTestId('deck-row')).toHaveText([/Llanowar Elves/])
  })
})
