import { expect, test, type Page } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 011: deck and add polish (AC-1 to AC-10).
const LIST = 'Deck\n1 Counterspell\n1 Lightning Bolt\n1 Shivan Dragon'
const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text })
const focused = (page: Page) => page.locator('[data-deck-card]:focus')

async function openAdd(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Add card' }).click()
  await page.getByLabel('Card name').fill(search)
  await page.getByTestId('card-results').getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('printing-picker')).toBeVisible()
  return page.getByRole('dialog')
}

test.describe('Deck and add polish', () => {
  test('AC-1: the List view shows a sticky side image of the hovered or focused card', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Side', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}?layout=list`)
    const side = page.getByTestId('deck-preview')
    await expect(side).toBeVisible()
    const first = await page.locator('[data-deck-card]').first().innerText()
    expect(first).toContain((await side.getAttribute('alt'))!)

    await deckRow(page, 'Shivan Dragon').hover()
    await expect(side).toHaveAttribute('alt', 'Shivan Dragon')
    await expect(page.getByTestId('card-preview')).toHaveCount(0)

    // Arrow keys move the side image too.
    await page.locator('[data-deck-card]').first().focus()
    await page.keyboard.press('ArrowDown')
    const name = (await focused(page).getAttribute('aria-label')) ?? (await focused(page).innerText())
    expect(['Counterspell', 'Lightning Bolt', 'Shivan Dragon'].some((n) => name.includes(n))).toBe(true)
    const alt = (await side.getAttribute('alt'))!
    expect(name).toContain(alt)

    // It stays in view while scrolling.
    await page.mouse.wheel(0, 400)
    await expect(side).toBeInViewport()

    // Phones show no side image.
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(side).toBeHidden()
  })

  test('AC-2: in the Text view the arrow keys open the large preview', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Keys', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}?layout=text`)
    await page.locator('[data-deck-card]').first().focus()
    await page.keyboard.press('ArrowDown')
    const preview = page.getByTestId('card-preview')
    await expect(preview).toBeVisible()
    const name = await focused(page).innerText()
    expect(name).toContain((await preview.getAttribute('alt'))!)
  })

  test('AC-3, AC-4: mirrored swap rows end with an Unpair icon that confirms (spec 021, AC-16)', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Swaps', 'casual', { text: LIST })
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; printing: { id: string; name: string } }[]
    const bolt = cards.find((c) => c.printing.name === 'Lightning Bolt')!
    const shivan = cards.find((c) => c.printing.name === 'Shivan Dragon')!
    await api.post(`/api/decks/${deck.id}/cards/${bolt.id}/swaps/`, { printing: shivan.printing.id })
    await page.goto(`/decks/${deck.id}?tab=swaps`)

    const row = page.getByTestId('swap-candidate')
    const out = await row.getByTestId('swap-out').boundingBox()
    const inn = await row.getByTestId('swap-in').boundingBox()
    expect(Math.abs(out!.width - inn!.width)).toBeLessThan(2)
    expect(out!.x).toBeLessThan(inn!.x)

    const unpair = row.getByRole('button', { name: 'Unpair' })
    await expect(unpair).toHaveText('')
    const box = await unpair.boundingBox()
    expect(box!.x).toBeGreaterThan(inn!.x + inn!.width - 1) // the fourth part, at the end

    await unpair.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(row).toHaveCount(1)
    await unpair.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Unpair' }).click()
    await expect(toast(page, /Unpaired/)).toBeVisible()
    await expect(row).toHaveCount(0)
    // Spec 021, AC-16: the card stays in the Maybeboard, now unpaired.
    await expect(page.getByTestId('unpaired-card')).toContainText('Shivan Dragon')
  })

  test('AC-5: the Add dialog keeps its size while searching', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    await page.getByLabel('Card name').fill('bo')
    const area = dialog.getByTestId('card-results-area')
    await expect(dialog.getByTestId('card-results')).toBeVisible()
    await expect.poll(() => dialog.evaluate((d) => d.getAnimations().length)).toBe(0) // opened
    const before = (await dialog.boundingBox())!
    const areaBefore = (await area.boundingBox())!
    await page.getByLabel('Card name').fill('lightning bolt')
    await expect(dialog.getByTestId('card-results').getByRole('button', { name: 'Lightning Bolt', exact: true })).toBeVisible()
    const after = (await dialog.boundingBox())!
    expect(after.width).toBe(before.width)
    expect((await area.boundingBox())!.height).toBe(areaBefore.height)

    await page.getByLabel('Card name').fill('zzzzqqq')
    await expect(area).toContainText('No cards found.')
    expect((await dialog.boundingBox())!.width).toBe(before.width)
    expect((await area.boundingBox())!.height).toBe(areaBefore.height)
  })

  test('AC-6 to AC-9: printings filter by finish, sort by price, show prices, set the finish, remembered', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    const dialog = await openAdd(page, 'bolt', 'Lightning Bolt')
    const printings = dialog.getByRole('radio')
    await expect(printings).toHaveCount(8)
    await expect(printings.first()).toHaveAccessibleName('Secret Lair Countdown #83')

    // AC-8: prices under each printing; unpriced ones show a dash.
    const fdc = dialog.getByTestId('printing-picker').locator('div.group').filter({ has: page.getByRole('radio', { name: /#163$/ }) })
    await expect(fdc.getByTestId('printing-price')).toContainText('1.88')

    // AC-7: Cheapest, unpriced last.
    await dialog.getByRole('combobox', { name: 'Sort printings' }).click()
    await page.getByRole('option', { name: 'Cheapest' }).click()
    await expect(printings.nth(0)).toHaveAccessibleName(/#163$/)
    await expect(printings.nth(1)).toHaveAccessibleName(/#806$/)
    await expect(printings.nth(2)).toHaveAccessibleName(/#2579$/)

    // AC-6, AC-8: Foil hides non-foil-only printings, prices in foil, Finish follows.
    await dialog.getByRole('group', { name: 'Filter printings' }).getByRole('button', { name: 'Foil', exact: true }).click()
    await expect(printings).toHaveCount(3)
    await expect(printings.nth(0)).toHaveAccessibleName(/#806$/)
    await expect(printings.nth(0).getByTestId('printing-price')).toContainText('2.41')
    await expect(printings.nth(2)).toHaveAccessibleName(/#83$/)
    await expect(dialog.getByRole('group', { name: 'Finish' }).getByRole('button', { pressed: true })).toHaveText('Foil')

    await dialog.getByRole('combobox', { name: 'Sort printings' }).click()
    await page.getByRole('option', { name: 'Priciest' }).click()
    await expect(printings.nth(0)).toHaveAccessibleName(/#2579$/)

    // AC-9: remembered in this browser, and the Finish field follows on open.
    await page.reload()
    await openAdd(page, 'bolt', 'Lightning Bolt')
    await expect(page.getByRole('radio', { name: /#/ })).toHaveCount(3)
    await expect(page.getByRole('radio', { name: /#/ }).first()).toHaveAccessibleName(/#2579$/)
    await expect(page.getByRole('combobox', { name: 'Sort printings' })).toHaveText('Priciest')
    await expect(page.getByRole('group', { name: 'Finish' }).getByRole('button', { pressed: true })).toHaveText('Foil')

    await page.getByRole('group', { name: 'Filter printings' }).getByRole('button', { name: 'Etched' }).click()
    await expect(page.getByTestId('printing-picker')).toContainText('No printings with this finish.')
  })

  test('AC-10: right-click an EDHREC card to open it or propose it as a swap', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Ramp', 'casual', { text: 'Deck\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Sol Ring').click()
    await cardDialog(page).getByRole('tab', { name: 'Played with' }).click()
    const rhystic = page.getByTestId('edhrec-played-with').getByRole('button', { name: 'Rhystic Study', exact: true })

    await rhystic.click({ button: 'right' })
    await expect(page.getByTestId('card-menu').getByRole('menuitem')).toHaveText(['Open', 'Propose swap'])
    await page.getByRole('menuitem', { name: 'Propose swap' }).click()
    await expect(toast(page, 'Rhystic Study could replace Sol Ring.')).toBeVisible()
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; zone: string; swap_for: number[]; printing: { name: string } }[]
    const sol = cards.find((c) => c.printing.name === 'Sol Ring')!
    expect(cards.find((c) => c.printing.name === 'Rhystic Study')).toMatchObject({ zone: 'maybe', swap_for: [sol.id] })

    // Open stacks the card.
    await rhystic.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open' }).click()
    await expect(cardDialog(page).getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()
  })
})
