import { expect, test, type Page } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 006: Images view, hover previews, group values, destructive buttons (AC-1 to AC-4).
const LIST = 'Deck\n1 Lightning Bolt (FDC) 163\n1 Shivan Dragon (FDN) 763\n2 Forest'
const tile = (page: Page, name: string) => page.getByTestId('card-tile').and(page.getByRole('button', { name, exact: true }))
const preview = (page: Page) => page.getByTestId('card-preview')

test.describe('Deck visual', () => {
  test('AC-1: Images view uses the collection tiles, grouped, with sizes remembered', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tiles', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}?layout=visual`)

    const lands = page.getByTestId('group-main-Lands')
    await expect(lands.getByTestId('card-tile')).toHaveCount(1)
    await expect(lands.getByTestId('card-quantity')).toHaveText('×2')
    await expect(lands.getByTestId('ownership')).toHaveAttribute('data-state', 'missing')
    await expect(lands.getByRole('button', { name: 'Preview Forest' })).toBeAttached() // fullscreen

    // Grid tiles show no hover preview (AC-2).
    await tile(page, 'Shivan Dragon').hover()
    await page.waitForTimeout(600)
    await expect(preview(page)).toHaveCount(0)

    const width = async () => (await tile(page, 'Shivan Dragon').boundingBox())!.width
    await page.getByLabel('Small cards').click()
    const small = await width()
    await page.getByLabel('Large cards').click()
    const large = await width()
    expect(large).toBeGreaterThan(small)
    await page.reload()
    expect(await width()).toBe(large)

    await tile(page, 'Shivan Dragon').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Propose swap' })).toBeVisible()
    await page.keyboard.press('Escape')
    await tile(page, 'Shivan Dragon').click()
    await expect(cardDialog(page)).toContainText('Shivan Dragon')
  })

  test('AC-2: hovering shows the large image in Swaps and the collection table; List rows use the side image', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Hover', 'casual', { text: LIST })
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; printing: { id: string; name: string } }[]
    const bolt = cards.find((c) => c.printing.name === 'Lightning Bolt')!
    const shivan = cards.find((c) => c.printing.name === 'Shivan Dragon')!
    await api.post(`/api/decks/${deck.id}/cards/${bolt.id}/swaps/`, { printing: shivan.printing.id })

    await page.goto(`/decks/${deck.id}?layout=list`)
    // The List view's side image is back instead of popups (spec 011, AC-1; deck-add-polish.spec.ts).
    await deckRow(page, 'Shivan Dragon').first().hover() // also a Maybeboard candidate
    await expect(page.getByTestId('deck-preview')).toHaveAttribute('alt', 'Shivan Dragon')
    await expect(preview(page)).toHaveCount(0)

    await page.getByRole('tab', { name: 'Swaps' }).click()
    await page.getByTestId('swap-in').getByRole('button', { name: 'Shivan Dragon' }).hover()
    await expect(preview(page)).toHaveAttribute('alt', 'Shivan Dragon')

    await api.importList('1 Lightning Bolt (FDC) 163')
    await page.goto('/cards')
    await page.getByLabel('Table view').click()
    await page.getByTestId('card-table').getByText('Lightning Bolt', { exact: true }).hover()
    await expect(preview(page)).toHaveAttribute('alt', 'Lightning Bolt')
  })

  test('AC-3, AC-4: group headings show count and value in every view; outlined Remove buttons', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Values', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}`)

    for (const layout of ['Text', 'List', 'Card images']) {
      await page.getByRole('button', { name: layout, exact: true }).click()
      const lands = page.getByTestId('group-main-Lands')
      await expect(lands).toContainText('Lands (2)')
      await expect(lands.getByTestId('group-value')).toHaveText(/^· \S*\d/)
    }

    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await deckRow(page, 'Forest').click()
    const remove = cardDialog(page).getByRole('button', { name: 'Remove from deck' })
    await expect(remove).toHaveClass(/border-destructive/)
    await expect(remove.locator('svg')).toHaveCount(1)
  })
})
