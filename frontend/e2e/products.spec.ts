import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { chanceLabel } from '../src/lib/products'
import { signUpAndLogIn } from './helpers'

// Spec 030: Products to buy, and every card a product can hold. The products come from the
// MTGJSON fixture (backend/products/fixtures), synced before the tests.

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
const rows = (page: Page, kind: 'decks' | 'boosters') => dialog(page).getByTestId(`products-${kind}`).getByTestId('product-row')
const names = (page: Page, kind: 'decks' | 'boosters') => rows(page, kind).getByTestId('product-name')

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
    await expect(rows(page, 'decks').first()).toBeVisible()
  })

  test('AC-1 to AC-7: decks and boosters holding the missing cards, with filters that are remembered', async ({ page, request }) => {
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

    // AC-3: most cards first, then newest. Arena and MTGO decks never show (AC-7).
    await expect(names(page, 'decks')).toHaveText([
      'Multiverse Reforged', 'Reign of Dragons', 'Odds and Ends', 'Scarlet', 'Lorehold Legacies', 'Prismari Performance',
    ])
    await expect(rows(page, 'decks').first().getByTestId('product-summary')).toHaveText('2 cards')
    await expect(rows(page, 'decks').nth(1).getByTestId('product-summary')).toHaveText('1 card')
    await expect(rows(page, 'decks').first()).toContainText('Reality Fracture Commander · 2026 · Commander Deck')

    // AC-4: boosters by chance per pack; Krenko is owned, so no Foundations boosters.
    const found = await api.get(`/api/decks/${deck.id}/products/`)
    const boosters = found.boosters as { product: { name: string }; chance: number }[]
    expect(boosters.map((b) => b.product.name).sort()).toEqual([
      'Commander Masters Collector Booster', 'Commander Masters Draft Booster', 'Commander Masters Set Booster',
      'Core Set 2021 Collector Booster', 'Core Set 2021 Draft Booster', 'Murders at Karlov Manor Collector Booster',
      'Murders at Karlov Manor Foil Promo Pack', 'Murders at Karlov Manor Play Booster', 'Murders at Karlov Manor Promo Pack',
      'The Zeta Set Booster',
    ])
    for (let i = 1; i < boosters.length; i++) expect(boosters[i - 1].chance).toBeGreaterThanOrEqual(boosters[i].chance)
    await dialog(page).getByRole('tab', { name: /Boosters/ }).click()
    await expect(names(page, 'boosters')).toHaveText(boosters.map((b) => b.product.name))
    await expect(rows(page, 'boosters').first().getByTestId('product-summary')).toHaveText(`${chanceLabel(boosters[0].chance)} per pack`)
    // AC-7: no Arena or MTGO product, at all.
    const all = [...found.decks, ...found.boosters].map((e: { product: { name: string } }) => e.product.name).join(' ')
    expect(all).not.toMatch(/arena|mtgo|redemption/i)

    // AC-5: a booster's cards with their own chance.
    const zeta = rows(page, 'boosters').filter({ hasText: 'The Zeta Set Booster' })
    await zeta.getByRole('button').click()
    await expect(zeta.getByTestId('product-card')).toHaveText([/Lightning Bolt/])
    const zetaChance = boosters.find((b) => b.product.name === 'The Zeta Set Booster')!.chance
    await expect(zeta.getByTestId('product-card-chance')).toHaveText(chanceLabel(zetaChance))
    await expect(zeta.getByTestId('product-all-cards')).toBeVisible()

    // AC-6: in no product.
    await expect(dialog(page).getByTestId('products-none-card')).toHaveText(['Rhystic Study'])

    // AC-2: Chosen printing: only products with the deck's printings.
    await pick(page, 'Printing', 'Chosen printing')
    await dialog(page).getByRole('tab', { name: /Decks/ }).click()
    await expect(names(page, 'decks')).toHaveText(['Multiverse Reforged', 'Lorehold Legacies', 'Prismari Performance'])
    // Released: the 2020-2024 products drop out; their cards are in no product.
    await pick(page, 'Released', 'Last 2 years')
    await expect(names(page, 'decks')).toHaveText(['Multiverse Reforged'])
    await expect(dialog(page).getByTestId('products-none-card')).toHaveText(['Forest', 'Lightning Helix', 'Rhystic Study', 'Smothering Tithe', 'Sol Ring'])
    // All cards: Krenko is looked for again.
    await pick(page, 'Cards', 'All cards')
    await dialog(page).getByRole('tab', { name: /Boosters/ }).click()
    await expect(names(page, 'boosters').filter({ hasText: 'Foundations' })).toHaveText(['Foundations Collector Booster', 'Foundations Play Booster'])

    // Remembered in this browser.
    await page.reload()
    await openProducts(page)
    await expect(dialog(page).getByRole('combobox', { name: 'Cards' })).toHaveText('All cards')
    await expect(dialog(page).getByRole('combobox', { name: 'Printing' })).toHaveText('Chosen printing')
    await expect(dialog(page).getByRole('combobox', { name: 'Released' })).toHaveText('Last 2 years')

    // AC-1: visitors of a public deck have it too; Missing is the owner's.
    // Signed out: a fresh browser storage.
    await page.evaluate(() => localStorage.clear())
    await page.context().clearCookies()
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await expect(page.getByTestId('user-menu')).toHaveCount(0)
    await openProducts(page)
    await expect(names(page, 'decks')).toHaveText([
      'Multiverse Reforged', 'Reign of Dragons', 'Odds and Ends', 'Scarlet', 'Lorehold Legacies', 'Prismari Performance',
    ])
    await dialog(page).getByRole('tab', { name: /Boosters/ }).click()
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
    await dialog(page).getByRole('tab', { name: /Boosters/ }).click()
    const zeta = rows(page, 'boosters').filter({ hasText: 'The Zeta Set Booster' })
    await zeta.getByRole('button').click()
    await zeta.getByTestId('product-all-cards').click()

    // AC-8: its own link.
    await expect(page).toHaveURL(/\/products\/slz-default\?from=/)
    await expect(page.getByTestId('product-title')).toHaveText('The Zeta Set Booster')
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
    await expect(tiles).toHaveCount(2)
    await expect(page.getByTestId('card-chance')).toHaveCount(0)
    await page.getByRole('button', { name: /Filters/ }).click()
    await expect(page.getByRole('combobox', { name: 'Owned' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.goto('/products/nope')
    await expect(page.getByTestId('product-missing')).toHaveText('No such product.')
  })
})
