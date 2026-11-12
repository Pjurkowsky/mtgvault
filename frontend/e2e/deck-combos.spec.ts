import { expect, test, type Page } from '@playwright/test'
import { cardDialog, closeCardDialog, logOut, signUpAndLogIn } from './helpers'

// Spec 022: combos from Commander Spellbook's dataset (AC-6 to AC-11).
// The fixture holds real combos: Dockside Extortionist + Cloudstone Curio (red),
// Dockside + Temur Sabertooth (red-green), Krenko + Skirk Prospector + a third card (red).
const KRENKO = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Dockside Extortionist\n1 Cloudstone Curio\n1 Sol Ring\n1 Forest'
const combo = (page: Page, group: 'in-deck' | 'could-build') => page.getByTestId(`combos-${group}`).getByTestId('combo')
const withCards = (page: Page, group: 'in-deck' | 'could-build', ...names: string[]) =>
  names.reduce((l, n) => l.filter({ has: page.getByAltText(n, { exact: true }) }), combo(page, group))

test.describe('Deck combos', () => {
  test('AC-6, AC-7, AC-9, AC-11: the Combos tab lists the combos in the deck', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Goblins', 'commander', { text: KRENKO })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('combos-tab')).toHaveText('Combos') // no count on the tab (spec 022, AC-6, changed)
    await page.getByTestId('combos-tab').click()
    await expect(page).toHaveURL(/tab=combos/)

    await expect(page.getByTestId('combos-in-deck').getByTestId('combos-count')).toHaveText('1')
    const row = combo(page, 'in-deck').first()
    await expect(row.getByTestId('combo-card')).toHaveCount(2)
    await expect(row.getByAltText('Dockside Extortionist', { exact: true })).toBeVisible()
    await expect(row.getByAltText('Cloudstone Curio', { exact: true })).toBeVisible()
    await expect(row.locator('[data-missing]')).toHaveCount(0)
    await expect(row.getByTestId('combo-infinite')).toBeVisible()
    await expect(row.getByTestId('combo-produces')).toContainText('Infinite artifact ETB')
    await expect(row.getByTestId('combo-link')).toHaveAttribute('href', 'https://commanderspellbook.com/combo/914-2232/')

    // Steps open on click.
    await expect(row.getByTestId('combo-steps')).toHaveCount(0)
    await row.getByTestId('combo-steps-toggle').click()
    await expect(row.getByTestId('combo-steps').locator('li').first()).toBeVisible()

    // A deck card opens its card dialog.
    await row.getByRole('button', { name: 'Open Cloudstone Curio' }).click()
    await expect(cardDialog(page)).toContainText('Cloudstone Curio')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('link', { name: 'Commander Spellbook', exact: true })).toHaveAttribute('href', 'https://commanderspellbook.com')
  })

  test('AC-8, AC-9, AC-10: could build fits the commander, marks owned cards, and Add puts a card in the Maybeboard', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Skirk Prospector')
    const deck = await api.deck('Goblins', 'commander', { text: KRENKO })
    await page.goto(`/decks/${deck.id}?tab=combos`)

    // Missing one card first.
    await expect(combo(page, 'could-build').first().locator('[data-missing]')).toHaveCount(1)
    // Krenko + Skirk Prospector + Goblin Warchief misses two; you own Skirk Prospector.
    const krenko = withCards(page, 'could-build', 'Krenko, Mob Boss', 'Skirk Prospector', 'Goblin Warchief')
    await expect(krenko).toHaveCount(1)
    await expect(krenko.locator('[data-missing]')).toHaveCount(2)
    const skirk = krenko.getByTestId('combo-card').filter({ has: page.getByAltText('Skirk Prospector') })
    await expect(skirk.getByTestId('combo-owned')).toHaveText('In collection')
    // Goblin Warchief isn't in the catalog fixture, so it can't be added.
    await expect(krenko.getByRole('button', { name: 'Add Goblin Warchief to the Maybeboard' })).toHaveCount(0)

    // A card not in the deck opens its card dialog too, without the deck section (AC-10).
    await expect(krenko.getByRole('button', { name: 'Open Goblin Warchief' })).toBeDisabled()
    await krenko.getByRole('button', { name: 'Open Skirk Prospector' }).click()
    await expect(cardDialog(page)).toContainText('Skirk Prospector')
    await expect(cardDialog(page).getByTestId('owned')).toHaveText('You own 1')
    await expect(cardDialog(page).getByTestId('deck-section')).toHaveCount(0)
    await closeCardDialog(page)

    // Out of the commander's colours: Dockside + Temur Sabertooth (RG), Krenko + Intruder Alarm (UR).
    await expect(withCards(page, 'could-build', 'Temur Sabertooth')).toHaveCount(0)
    await expect(withCards(page, 'could-build', 'Intruder Alarm')).toHaveCount(0)
    // Only infinite or win combos.
    const rows = combo(page, 'could-build')
    for (const i of [0, 1, 2]) {
      await expect(rows.nth(i).getByTestId('combo-infinite').or(rows.nth(i).getByTestId('combo-win'))).toBeVisible()
    }

    await skirk.getByRole('button', { name: 'Add Skirk Prospector to the Maybeboard' }).click()
    await expect(page.getByText('Added Skirk Prospector to the Maybeboard.')).toBeVisible()
    const after = await api.get(`/api/decks/${deck.id}/`)
    expect(after.cards.find((c: { printing: { name: string } }) => c.printing.name === 'Skirk Prospector').zone).toBe('maybe')
  })

  test('AC-8: other formats have no colour limit, and Show more pages the list', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Treasure', 'casual', { text: '1 Dockside Extortionist\n1 Krenko, Mob Boss\n1 Smothering Tithe\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}?tab=combos`)
    await expect(withCards(page, 'could-build', 'Dockside Extortionist', 'Temur Sabertooth')).toHaveCount(1)
    await expect(page.getByTestId('combos-in-deck')).toContainText('No combos.')

    const total = Number(await page.getByTestId('combos-could-build').getByTestId('combos-count').textContent())
    expect(total).toBeGreaterThan(20)
    await expect(combo(page, 'could-build')).toHaveCount(20)
    await page.getByTestId('combos-more').click()
    await expect(combo(page, 'could-build')).toHaveCount(Math.min(40, total))
  })

  test('AC-6, AC-9, AC-10: visitors of a public deck see combos without Add or ownership', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    await api.importList('1 Skirk Prospector')
    const deck = await api.deck('Shared', 'commander', { text: KRENKO, is_public: true })
    await logOut(page)
    await page.goto(`/u/${user.username}/decks/${deck.id}?tab=combos`)
    await expect(combo(page, 'in-deck')).toHaveCount(1)
    await expect(combo(page, 'could-build').first()).toBeVisible()
    await expect(page.getByTestId('deck-combos').getByRole('button', { name: /^Add / })).toHaveCount(0)
    await expect(page.getByTestId('combo-owned')).toHaveCount(0)
  })
})
