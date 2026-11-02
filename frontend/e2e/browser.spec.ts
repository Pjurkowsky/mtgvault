import { expect, test, type Page } from '@playwright/test'
import { clearFilters, fixtureList, signUpAndLogIn } from './helpers'

// Sol Ring (colorless, €0.91), Lightning Bolt (red, €1.91), Counterspell (blue, €3.36),
// Lightning Helix (red/white, €0.14), Llanowar Elves (green creature, €0.38), Forest (foil, €0.18).
const LIST = `1 Sol Ring (C21) 263
1 Lightning Bolt (MSC) 806
1 Counterspell (FDC) 61
1 Lightning Helix (MKM) 218
1 Forest (M21) 272 *F*`

const names = (page: Page) => page.getByTestId('card-tile').evaluateAll((tiles) => tiles.map((t) => t.querySelector('img')!.alt))

async function filter(page: Page, apply: (panel: ReturnType<Page['getByTestId']>) => Promise<void>) {
  await page.getByRole('button', { name: 'Filters' }).click()
  await apply(page.getByTestId('filter-panel'))
  await page.keyboard.press('Escape')
}

test.describe('Card browser', () => {
  test.beforeEach(async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Red Binder')
    await api.importList(LIST, binder)
    await api.importList('1 Llanowar Elves (FDC) 213', null, { condition: 'LP' })
    await page.goto('/cards')
    await expect(page.getByTestId('browser-summary')).toContainText('6 cards')
  })

  test('AC-29: grid and table views; the choice is remembered', async ({ page }) => {
    await expect(page.getByTestId('card-grid')).toBeVisible()
    await page.getByLabel('Table view').click()
    await expect(page.getByTestId('card-table')).toBeVisible()
    await expect(page.getByTestId('card-table').getByRole('columnheader')).toHaveText(
      ['', 'Image', 'Name', 'Set', '#', 'Finish', 'Condition', 'Language', 'Qty', 'Price', 'Location'])
    await page.goto('/cards')
    await expect(page.getByTestId('card-table')).toBeVisible()
  })

  test('AC-30: search by name, ignoring case, including back faces', async ({ page }) => {
    await page.getByLabel('Search cards').fill('LIGHTNING')
    await expect.poll(() => names(page)).toEqual(['Lightning Bolt', 'Lightning Helix'])
    await page.getByLabel('Search cards').fill('helix')
    await expect.poll(() => names(page)).toEqual(['Lightning Helix'])
  })

  test('AC-31: each filter, and filters combine with AND', async ({ page }) => {
    await filter(page, (p) => p.getByRole('button', { name: 'Red' }).click())
    await expect.poll(() => names(page)).toEqual(['Lightning Bolt', 'Lightning Helix'])
    await clearFilters(page)

    await filter(page, (p) => p.getByRole('button', { name: 'Colorless' }).click())
    await expect.poll(() => names(page)).toEqual(['Forest', 'Sol Ring'])
    await clearFilters(page)

    await filter(page, (p) => p.getByRole('checkbox', { name: 'Creature' }).click())
    await expect.poll(() => names(page)).toEqual(['Llanowar Elves'])
    await clearFilters(page)

    await filter(page, (p) => p.getByRole('checkbox', { name: 'Foil', exact: true }).click())
    await expect.poll(() => names(page)).toEqual(['Forest'])
    await clearFilters(page)

    await filter(page, (p) => p.getByRole('checkbox', { name: 'Lightly Played' }).click())
    await expect.poll(() => names(page)).toEqual(['Llanowar Elves'])
    await clearFilters(page)

    await filter(page, async (p) => {
      await p.getByLabel('Set').fill('Commander 2021')
      await p.getByRole('checkbox', { name: /Commander 2021/ }).click()
    })
    await expect.poll(() => names(page)).toEqual(['Sol Ring'])
    await clearFilters(page)

    await filter(page, async (p) => {
      await p.getByLabel('Minimum price').fill('1')
      await p.getByLabel('Maximum price').fill('2')
      await p.getByLabel('Maximum price').press('Enter')
    })
    await expect.poll(() => names(page)).toEqual(['Lightning Bolt'])
    await clearFilters(page)

    // AND across filters: red + uncommon + instant + price ≥ 1
    await filter(page, async (p) => {
      await p.getByRole('button', { name: 'Red' }).click()
      await p.getByRole('checkbox', { name: 'Uncommon' }).click()
      await p.getByRole('checkbox', { name: 'Instant' }).click()
    })
    await expect.poll(() => names(page)).toEqual(['Lightning Bolt', 'Lightning Helix'])
    await filter(page, async (p) => {
      await p.getByLabel('Minimum price').fill('1')
      await p.getByLabel('Minimum price').press('Enter')
    })
    await expect.poll(() => names(page)).toEqual(['Lightning Bolt'])
  })

  // AC-32 (filter chips) is replaced by spec 002 AC-21: see polish-browser.spec.ts.

  test('AC-33: sort options in both directions', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Sort by' }).click()
    await expect(page.getByRole('option')).toHaveText(['Name', 'Set', 'Rarity', 'Price', 'Quantity', 'Date added', 'Color', 'Mana value'])
    await page.getByRole('option', { name: 'Price' }).click()
    await expect.poll(async () => (await names(page))[0]).toBe('Lightning Helix')
    await page.getByRole('button', { name: 'Ascending' }).click()
    await expect.poll(async () => (await names(page))[0]).toBe('Counterspell')
    await expect.poll(() => names(page)).toEqual(['Counterspell', 'Lightning Bolt', 'Sol Ring', 'Llanowar Elves', 'Forest', 'Lightning Helix'])
  })

  test('AC-34: search, filters, sort and view live in the URL', async ({ page }) => {
    await page.getByLabel('Search cards').fill('lightning')
    await filter(page, (p) => p.getByRole('button', { name: 'Red' }).click())
    await page.getByLabel('Table view').click()
    await expect(page).toHaveURL(/q=lightning/)
    await expect(page).toHaveURL(/color=R/)
    await expect(page).toHaveURL(/view=table/)
    const url = page.url()

    await page.reload()
    await expect(page.getByLabel('Search cards')).toHaveValue('lightning')
    await expect(page.getByRole('button', { name: 'Filters' })).toContainText('1')
    await expect(page.getByTestId('card-table')).toBeVisible()

    await page.goto('/')
    await page.goBack()
    await expect(page).toHaveURL(url)
    await expect(page.getByTestId('card-row')).toHaveCount(2)
  })

  test('AC-37: All cards shows rows from every location and Unfiled', async ({ page }) => {
    await page.getByLabel('Table view').click()
    const locations = page.getByTestId('card-row').locator('td:last-child')
    await expect(locations).toHaveText(['Red Binder', 'Red Binder', 'Red Binder', 'Red Binder', 'Unfiled', 'Red Binder'])
  })
})

test('AC-35: loads more as you scroll and shows totals', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await api.importList(fixtureList())
  await api.importList(fixtureList(), null, { condition: 'LP' })
  await page.goto('/cards')
  await expect(page.getByTestId('browser-summary')).toContainText('92 cards')
  await expect(page.getByTestId('card-tile')).toHaveCount(60)
  await page.getByTestId('card-tile').last().scrollIntoViewIfNeeded()
  await expect(page.getByTestId('card-tile')).toHaveCount(92)
})
