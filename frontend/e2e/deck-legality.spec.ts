import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

const issues = (page: Page) => page.getByTestId('legality').locator('li')

test.describe('Deck legality and stats', () => {
  test('AC-22: Commander checks commander, size, singleton and colors; basics are unlimited', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Bad commander', 'commander', {
      text: 'Commander\n1 Shivan Dragon\n\nDeck\n2 Sol Ring\n20 Forest\n1 Counterspell',
    })
    await page.goto(`/decks/${deck.id}?tab=stats`)
    await expect(page.getByTestId('legality')).toContainText('Not legal in Commander')
    await expect(issues(page)).toHaveText([
      'Too many copies: Sol Ring (2/1).',
      'Commander decks have exactly 100 cards; this one has 24.',
      'Shivan Dragon cannot be a commander.',
      "Outside the commander's colors: 2 cards.",
    ])
    await expect(page.getByTestId('deck-legal')).toHaveText('4 issues')
  })

  test('AC-22: a valid commander and its colors', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Piper', 'commander', { text: 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Sol Ring\n98 Forest' })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('deck-size')).toHaveText('100 / 100 cards')
    await expect(page.getByTestId('deck-legal')).toHaveText('1 issue')
    await page.getByTestId('deck-legal').click()
    // Forest is green; the Piper is colorless.
    await expect(issues(page)).toHaveText(["Outside the commander's colors: 1 card."])
  })

  test('AC-22, AC-23: constructed formats: card legality, 4 copies, 60 cards, sideboard 15; the Maybeboard never counts', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Modern', 'modern', {
      text: 'Deck\n5 Lightning Bolt\n1 Sol Ring\n40 Forest\n\nSideboard\n16 Forest\n\nMaybeboard\n1 Brainstorm\n9 Shivan Dragon',
    })
    await page.goto(`/decks/${deck.id}?tab=stats`)
    await expect(issues(page)).toHaveText([
      'Not legal in Modern: 1 card.',
      'Too many copies: Lightning Bolt (5/4).',
      'Modern decks have at least 60 cards in the mainboard; this one has 46.',
      'The sideboard has 16 cards; at most 15.',
    ])
  })

  test('AC-22: restricted cards allow one copy; Casual has no rules', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const vintage = await api.deck('Vintage', 'vintage', { text: '2 Sol Ring\n58 Forest' })
    await page.goto(`/decks/${vintage.id}?tab=stats`)
    await expect(issues(page)).toHaveText(['Too many copies: Sol Ring (2/1).'])

    await api.patch(`/api/decks/${vintage.id}/`, { format: 'legacy' })
    await page.reload()
    await expect(issues(page)).toHaveText(['Banned in Legacy: 1 card.'])

    await api.patch(`/api/decks/${vintage.id}/`, { format: 'casual' })
    await page.reload()
    await expect(page.getByTestId('legality')).toHaveCount(0)
    await expect(page.getByTestId('deck-legal')).toHaveCount(0)
  })

  test('AC-24: mana curve, pips, types, average mana value and value', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('4 Lightning Bolt (FDC) 163')
    const deck = await api.deck('Stats', 'casual', {
      text: '4 Lightning Bolt (FDC) 163\n2 Counterspell (FDC) 61\n1 Shivan Dragon (FDN) 763\n20 Forest\n\nMaybeboard\n1 Sol Ring',
    })
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('tab', { name: 'Stats' }).click()
    const curve = page.getByTestId('mana-curve')
    await expect(curve.locator('[data-mv="1"]')).toContainText('4')
    await expect(curve.locator('[data-mv="2"]')).toContainText('2')
    await expect(curve.locator('[data-mv="6"]')).toContainText('1')
    await expect(curve.locator('[data-mv="7+"]')).toContainText('0')
    // (4×1 + 2×2 + 6) / 7 non-land cards
    await expect(page.getByTestId('average-mv')).toHaveText('Average mana value 2.00')
    // Blue 2×2, red 4×1 + 1×2
    await expect(page.getByTestId('pips').locator('li')).toHaveText(['4', '6'])
    await expect(page.getByTestId('types')).toContainText('Instant6')
    await expect(page.getByTestId('types')).toContainText('Land20')

    const value = await api.get(`/api/decks/${deck.id}/`)
    const v = value.stats.value
    expect(v.owned + v.missing).toBeCloseTo(v.total, 2)
    expect(v.owned).toBeGreaterThan(0)
    await expect(page.getByTestId('deck-value')).toContainText('Owned')
  })
})
