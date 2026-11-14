import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { chanceLabel } from '../src/lib/products'
import { signUpAndLogIn } from './helpers'

// Spec 030: Products to buy, and every card a product can hold; spec 032: four tabs, photos,
// commanders, cards as images by type, no basic lands. The products come from the MTGJSON
// fixture (backend/products/fixtures), synced before the tests.

/** Run Django shell code against the e2e database. */
function shell(code: string) {
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c', code], {
    cwd: new URL('../../backend/', import.meta.url).pathname, env: { ...process.env, DATABASE_URL },
  })
}

const DECK = [
  '1 Sol Ring (C21) 263',
  '1 Lightning Bolt (SLZ) 63',
  '1 Krenko, Mob Boss (FDN) 204',
  '1 Brainstorm (FRC) 39',
  '1 Swords to Plowshares (FRC) 37',
  '1 Smothering Tithe (CMM) 57',
  '1 Rhystic Study',
  '1 Forest (M21) 272',
  '1 Lightning Helix (MKM) 218',
].join('\n')

const dialog = (page: Page) => page.getByTestId('products-dialog')
type Section = 'precons' | 'boosters' | 'other_decks' | 'other_boosters'
type Entry = { product: { name: string; image: string }; count: number; cards: { printing: { name: string }; chance: number | null }[] }
const rows = (page: Page, section: Section) => dialog(page).getByTestId(`products-${section}`).getByTestId('product-row')
const names = (page: Page, section: Section) => rows(page, section).getByTestId('product-name')
const tab = (page: Page, name: string) => dialog(page).getByRole('tab', { name: new RegExp(`^${name} `) })

async function openProducts(page: Page) {
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Products to buy' }).click()
  await expect(dialog(page)).toBeVisible()
}

async function pick(page: Page, label: 'Cards' | 'Printing' | 'Released', option: string) {
  await dialog(page).getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.describe('Products to buy', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  test('AC-12: until the first product sync the dialog says there is no product data', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck(`No data ${Date.now()}`, 'casual', { text: DECK })
    shell("from cards.models import SyncRun; SyncRun.objects.filter(kind='products', status='success').update(status='failed')")
    try {
      await page.goto(`/decks/${deck.id}`)
      await openProducts(page)
      await expect(dialog(page).getByTestId('products-no-data')).toHaveText('No product data yet.')
    } finally {
      shell("from cards.models import SyncRun; SyncRun.objects.filter(kind='products', status='failed', error='').update(status='success')")
    }
    await page.reload()
    await openProducts(page)
    await expect(rows(page, 'precons').first()).toBeVisible()
  })

  test('AC-1 to AC-7, spec 032 AC-1 to AC-7: products in four tabs, with photos, commanders and cards by type; filters remembered', async ({ page, request }) => {
    const { api, user } = await signUpAndLogIn(page, request)
    const deck = await api.deck(`Products ${Date.now()}`, 'casual', { text: DECK, is_public: true })
    // Owned, so not missing.
    await api.importList('1 Krenko, Mob Boss (FDN) 204')
    await page.goto(`/decks/${deck.id}`)
    await openProducts(page)

    // AC-2: the defaults.
    await expect(dialog(page).getByRole('combobox', { name: 'Cards' })).toHaveText('Missing')
    await expect(dialog(page).getByRole('combobox', { name: 'Printing' })).toHaveText('Any printing')
    await expect(dialog(page).getByRole('combobox', { name: 'Released' })).toHaveText('Any year')

    // Spec 032, AC-1: four tabs with their counts; an empty one shows 0.
    const found = await api.get(`/api/decks/${deck.id}/products/`)
    const sections = found.sections as Record<Section, Entry[]>
    await expect(dialog(page).getByRole('tab')).toHaveText([
      `Precons ${sections.precons.length}`, `Boosters ${sections.boosters.length}`,
      `Other decks ${sections.other_decks.length}`, `Other boosters ${sections.other_boosters.length}`,
    ])

    // AC-3, spec 032 AC-1, AC-2: Commander precons, most cards first, then newest. Arena and MTGO decks never show (AC-7).
    await expect(names(page, 'precons')).toHaveText([
      'Multiverse Reforged', 'Reign of Dragons', 'Odds and Ends', 'Lorehold Legacies', 'Prismari Performance',
    ])
    await expect(rows(page, 'precons').first().getByTestId('product-summary')).toHaveText('2 cards')
    await expect(rows(page, 'precons').nth(1).getByTestId('product-summary')).toHaveText('1 card')
    await expect(rows(page, 'precons').first()).toContainText('Reality Fracture Commander · 2026 · Commander Deck')
    // Spec 032, AC-3: the commander's image and name.
    await expect(rows(page, 'precons').first().getByTestId('product-commanders')).toHaveText('The Prismatic Piper')
    await expect(rows(page, 'precons').first().getByTestId('product-commander-image')).toHaveAttribute('alt', 'The Prismatic Piper')
    await expect(rows(page, 'precons').nth(1).getByTestId('product-commanders')).toHaveText('Krenko, Mob Boss')
    // Spec 032, AC-4: a precon without a commander shows its photo; no photo, a placeholder.
    await expect(rows(page, 'precons').nth(3).getByTestId('product-photo')).toHaveAttribute('src', /\/product\/235092_200w\.jpg$/)
    await expect(rows(page, 'precons').nth(2).getByTestId('product-placeholder')).toBeVisible()

    // Spec 032, AC-1: Jumpstart themes are Other decks.
    await tab(page, 'Other decks').click()
    await expect(names(page, 'other_decks')).toHaveText(['Scarlet'])

    // AC-4, spec 032 AC-1, AC-2: regular packs, most cards first, "N cards" and no chance per pack.
    // Krenko is owned, so no Foundations boosters; Core Set 2021 ones held only the Forest.
    expect(sections.boosters.map((b) => b.product.name).sort()).toEqual([
      'Commander Masters Collector Booster', 'Commander Masters Draft Booster', 'Commander Masters Set Booster',
      'Murders at Karlov Manor Collector Booster', 'Murders at Karlov Manor Play Booster',
    ])
    for (const list of Object.values(sections)) {
      for (let i = 1; i < list.length; i++) expect(list[i - 1].count).toBeGreaterThanOrEqual(list[i].count)
    }
    await tab(page, 'Boosters').click()
    await expect(names(page, 'boosters')).toHaveText(sections.boosters.map((b) => b.product.name))
    await expect(rows(page, 'boosters').getByTestId('product-summary')).toHaveText(sections.boosters.map((b) => `${b.count} ${b.count === 1 ? 'card' : 'cards'}`))
    await expect(rows(page, 'boosters').first().getByTestId('product-photo')).toHaveAttribute('src', sections.boosters[0].product.image)
    // Promo packs and a 7-card pack are Other boosters.
    await tab(page, 'Other boosters').click()
    expect(sections.other_boosters.map((b) => b.product.name).sort()).toEqual([
      'Murders at Karlov Manor Foil Promo Pack', 'Murders at Karlov Manor Promo Pack', 'The Zeta Set Booster',
    ])
    // AC-7: no Arena or MTGO product, at all.
    const all = Object.values(sections).flat().map((e) => e.product.name).join(' ')
    expect(all).not.toMatch(/arena|mtgo|redemption/i)

    // AC-5, spec 032 AC-5, AC-6: a booster's cards as images by type, each with its own chance.
    const zeta = rows(page, 'other_boosters').filter({ hasText: 'The Zeta Set Booster' })
    await zeta.getByRole('button').first().click()
    await expect(zeta.getByTestId('product-type').locator('h4')).toHaveText(['Instants 1'])
    await expect(zeta.getByTestId('product-card')).toHaveAttribute('aria-label', 'Lightning Bolt')
    await expect(zeta.getByTestId('product-card').locator('img')).toHaveAttribute('alt', 'Lightning Bolt')
    const zetaCard = sections.other_boosters.find((b) => b.product.name === 'The Zeta Set Booster')!.cards[0]
    await expect(zeta.getByTestId('product-card-chance')).toHaveText(chanceLabel(zetaCard.chance!))
    await expect(zeta.getByTestId('product-all-cards')).toBeVisible()
    // Spec 032, AC-5: the card size, remembered.
    await expect(zeta.locator('ul')).toHaveAttribute('data-size', 'sm')
    await dialog(page).getByRole('radio', { name: 'Large cards' }).or(dialog(page).getByRole('button', { name: 'Large cards' })).click()
    await expect(zeta.locator('ul')).toHaveAttribute('data-size', 'lg')
    // Spec 032, AC-6: a deck card with 2 copies.
    await tab(page, 'Other decks').click()
    const scarlet = rows(page, 'other_decks').first()
    await scarlet.getByRole('button').first().click()
    await expect(scarlet.getByTestId('product-card-copies')).toHaveText('×2')
    await expect(scarlet.getByTestId('product-card-chance')).toHaveCount(0)

    // AC-6: in no product. Spec 032, AC-7: the deck's Forest is never looked for.
    await expect(dialog(page).getByTestId('products-none-card')).toHaveText(['Rhystic Study'])

    // AC-2: Chosen printing: only products with the deck's printings.
    await pick(page, 'Printing', 'Chosen printing')
    await tab(page, 'Precons').click()
    await expect(names(page, 'precons')).toHaveText(['Multiverse Reforged', 'Lorehold Legacies', 'Prismari Performance'])
    // Released: the 2020-2024 products drop out; their cards are in no product, but never the Forest.
    await pick(page, 'Released', 'Last 2 years')
    await expect(names(page, 'precons')).toHaveText(['Multiverse Reforged'])
    await expect(dialog(page).getByTestId('products-none-card')).toHaveText(['Lightning Helix', 'Rhystic Study', 'Smothering Tithe', 'Sol Ring'])
    // All cards: Krenko is looked for again.
    await pick(page, 'Cards', 'All cards')
    await tab(page, 'Boosters').click()
    await expect(names(page, 'boosters').filter({ hasText: 'Foundations' })).toHaveText(['Foundations Collector Booster', 'Foundations Play Booster'])
    // Spec 032, AC-7: Lorehold Legacies holds 10 Forests, which never count.
    await pick(page, 'Released', 'Any year')
    await pick(page, 'Printing', 'Any printing')
    await tab(page, 'Precons').click()
    await expect(rows(page, 'precons').filter({ hasText: 'Lorehold Legacies' }).getByTestId('product-summary')).toHaveText('1 card')
    await pick(page, 'Printing', 'Chosen printing')
    await pick(page, 'Released', 'Last 2 years')

    // Remembered in this browser.
    await page.reload()
    await openProducts(page)
    await expect(dialog(page).getByRole('combobox', { name: 'Cards' })).toHaveText('All cards')
    await expect(dialog(page).getByRole('combobox', { name: 'Printing' })).toHaveText('Chosen printing')
    await expect(dialog(page).getByRole('combobox', { name: 'Released' })).toHaveText('Last 2 years')
    await expect(dialog(page).getByRole('button', { name: 'Large cards' }).or(dialog(page).getByRole('radio', { name: 'Large cards' }))).toHaveAttribute('data-state', 'on')

    // AC-1: visitors of a public deck have it too; Missing is the owner's.
    // Signed out: a fresh browser storage.
    await page.evaluate(() => localStorage.clear())
    await page.context().clearCookies()
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await expect(page.getByTestId('user-menu')).toHaveCount(0)
    await openProducts(page)
    await expect(names(page, 'precons')).toHaveText([
      'Multiverse Reforged', 'Reign of Dragons', 'Odds and Ends', 'Lorehold Legacies', 'Prismari Performance',
    ])
    await tab(page, 'Boosters').click()
    await expect(names(page, 'boosters').filter({ hasText: 'Foundations' })).toHaveCount(0)
  })

  test('AC-8 to AC-11: a product page lists every card it can hold, filtered like a collection', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck(`Product page ${Date.now()}`, 'casual', { text: DECK })
    await api.importList('2 Lightning Bolt (SLZ) 184\n1 Dark Ritual (SLZ) 38')
    await page.goto(`/decks/${deck.id}`)
    await openProducts(page)
    // Bolt is owned now, so not missing: look for all the deck's cards.
    await pick(page, 'Cards', 'All cards')
    await pick(page, 'Printing', 'Any printing')
    await pick(page, 'Released', 'Any year')
    await tab(page, 'Other boosters').click()
    const zeta = rows(page, 'other_boosters').filter({ hasText: 'The Zeta Set Booster' })
    await zeta.getByRole('button').first().click()
    await zeta.getByTestId('product-all-cards').click()

    // AC-8: its own link.
    await expect(page).toHaveURL(/\/products\/slz-default\?from=/)
    await expect(page.getByTestId('product-title')).toHaveText('The Zeta Set Booster')
    await expect(page.getByTestId('product-photo')).toHaveAttribute('src', /\/product\/714891_200w\.jpg$/)
    await expect(page.getByTestId('product-meta')).toHaveText('The Zeta Set · 2026 · 8 cards')
    // AC-9: each printing is its own card.
    const tiles = page.getByTestId('card-tile')
    await expect(tiles).toHaveCount(8)
    // AC-10: chance per pack on each card, and a sort by it.
    const cards = await (await request.get('/api/products/slz-default/cards/?sort=chance&dir=desc')).json()
    await page.getByRole('combobox', { name: 'Sort by' }).click()
    await page.getByRole('option', { name: 'Chance' }).click()
    await page.getByRole('button', { name: 'Ascending' }).click()
    await expect(page.getByTestId('card-chance')).toHaveText(cards.results.map((r: { chance: number }) => chanceLabel(r.chance)))
    // AC-11: owned copies (any printing) and the Owned filter. Bolt: 2 copies, Dark Ritual: 1.
    await expect(page.getByTestId('card-owned')).toHaveCount(6)
    await page.getByRole('button', { name: /Filters/ }).click()
    await page.getByRole('combobox', { name: 'Owned' }).click()
    await page.getByRole('option', { name: 'Not owned' }).click()
    await page.keyboard.press('Escape')
    await expect(tiles).toHaveCount(2)
    await expect(page.getByTestId('card-owned')).toHaveCount(0)
    // Search, like a collection.
    await page.goto('/products/slz-default?q=ritual')
    await expect(tiles).toHaveCount(3)

    // Table view: Chance and Owned columns.
    await page.goto('/products/slz-default?view=table&q=bolt')
    await expect(page.getByTestId('card-row')).toHaveCount(3)
    await expect(page.getByTestId('card-owned')).toHaveText(['2', '2', '2'])

    // Back to the deck it was opened from.
    await page.goto(`/products/slz-default?from=/decks/${deck.id}`)
    await page.getByTestId('product-back').click()
    await expect(page).toHaveURL(new RegExp(`/decks/${deck.id}$`))

    // AC-8: the link works signed out, without owned marks or the Owned filter.
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await page.goto('/products/frc-multiverse-reforged')
    await expect(page.getByTestId('product-title')).toHaveText('Multiverse Reforged')
    // Spec 032: the commander is one of its cards.
    await expect(tiles).toHaveCount(3)
    await expect(page.getByTestId('card-chance')).toHaveCount(0)
    await page.getByRole('button', { name: /Filters/ }).click()
    await expect(page.getByRole('combobox', { name: 'Owned' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto('/products/nope')
    await expect(page.getByTestId('product-missing')).toHaveText('No such product.')
  })
})
