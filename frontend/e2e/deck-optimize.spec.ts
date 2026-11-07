import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 013: optimize printings (AC-1 to AC-6). EUR prices from the fixture:
// Lightning Bolt SLD #2579 €8.42, FDC #163 €1.88; Counterspell FDC #61 €3.36, SLD #7123 €0.02;
// Sol Ring has one printing.
const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text })

async function openOptimize(page: Page) {
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Optimize printings' }).click()
}

type Card = { id: number; zone: string; printing: { name: string; set_code: string; collector_number: string } }
const printingOf = async (api: { get: (p: string) => Promise<{ cards: Card[] }> }, deck: number, name: string) => {
  const card = (await api.get(`/api/decks/${deck}/`)).cards.find((c) => c.printing.name === name)!
  return `${card.printing.set_code.toUpperCase()} #${card.printing.collector_number}`
}

test.describe('Optimize printings', () => {
  test('AC-1 to AC-6: preview grouped by state, totals follow the ticks, apply only ticked, this deck only', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    // Counterspell's only copy sits in another deck's box: In other decks.
    const other = await api.deck('Other', 'casual', { create_box: true, text: '1 Counterspell (FDC) 61' })
    await api.importList('1 Counterspell (FDC) 61', other.location)
    const deck = await api.deck('Budget', 'casual', {
      text: 'Deck\n4 Lightning Bolt (SLD) 2579\n1 Counterspell (FDC) 61\n1 Sol Ring (C21) 263',
    })
    await page.goto(`/decks/${deck.id}`)
    await openOptimize(page)

    const dialog = page.getByTestId('optimize-dialog')
    await expect(dialog.getByRole('heading')).toHaveText(['Optimize printings', 'Missing', 'In other decks'])
    const bolt = dialog.getByTestId('optimize-missing').getByTestId('optimize-row')
    const counter = dialog.getByTestId('optimize-other_decks').getByTestId('optimize-row')
    await expect(bolt).toHaveCount(1) // Sol Ring has no cheaper printing
    await expect(bolt).toContainText('Lightning Bolt')
    await expect(bolt.getByTestId('optimize-from')).toHaveText('SLD #2579')
    await expect(bolt.getByTestId('optimize-to')).toHaveText('FDC #163')
    await expect(bolt).toContainText('€8.42')
    await expect(bolt).toContainText('€1.88')
    await expect(bolt.getByTestId('optimize-saving')).toHaveText('−€6.54')
    await expect(counter.getByTestId('optimize-to')).toHaveText('SLD #7123')

    // AC-3: To buy counts missing copies only (4 Bolts and a Sol Ring).
    const totals = dialog.getByTestId('optimize-totals')
    await expect(totals).toContainText('€34.59')
    await expect(dialog.getByTestId('optimize-after')).toHaveText('€8.43')
    await bolt.getByRole('checkbox').click()
    await expect(dialog.getByTestId('optimize-after')).toHaveText('€34.59')
    await bolt.getByRole('checkbox').click()
    await counter.getByRole('checkbox').click()
    await expect(dialog.getByTestId('optimize-after')).toHaveText('€8.43')

    // AC-4: only the ticked card changes.
    await dialog.getByRole('button', { name: 'Apply' }).click()
    await expect(toast(page, 'Changed 1 printing.')).toBeVisible()
    await expect(dialog).toBeHidden()
    expect(Number((await api.get(`/api/decks/${deck.id}/`)).stats.value.missing)).toBe(8.43) // prices update
    expect(await printingOf(api, deck.id, 'Lightning Bolt')).toBe('FDC #163')
    expect(await printingOf(api, deck.id, 'Counterspell')).toBe('FDC #61')

    // The rest later; then nothing is left (AC-5).
    await openOptimize(page)
    await expect(dialog.getByTestId('optimize-row')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Apply' }).click()
    await expect(toast(page, 'Changed 1 printing.')).toBeVisible()
    expect(await printingOf(api, deck.id, 'Counterspell')).toBe('SLD #7123')
    await openOptimize(page)
    await expect(toast(page, 'Missing cards already use their cheapest printings.')).toBeVisible()
    await expect(dialog).toHaveCount(0)

    // AC-6: the other deck, its box and the collection keep their printing.
    expect(await printingOf(api, other.id, 'Counterspell')).toBe('FDC #61')
    const items = (await api.get(`/api/items/?location=${other.location}`)).results as { printing: { set_code: string } }[]
    expect(items.map((i) => i.printing.set_code)).toEqual(['fdc'])
  })

  test('AC-1: visitors see no Optimize printings', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Shown', 'casual', { is_public: true, text: 'Deck\n4 Lightning Bolt (SLD) 2579' })
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await expect(page.getByRole('heading', { name: 'Shown' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
  })
})
