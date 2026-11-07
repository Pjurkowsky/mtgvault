import { expect, test, type Locator, type Page } from '@playwright/test'
import { binderSlot as slot, showUnplaced, signUpAndLogIn } from './helpers'

// Spec 007: the Unplaced tray, placing and moving cards, shared pockets (AC-12 to AC-19).
const LIST = '2 Sol Ring (C21) 263\n1 Lightning Bolt (FDC) 163\n1 Llanowar Elves (FDC) 213'
const tray = (page: Page) => page.getByTestId('unplaced-tray')
const trayCard = (page: Page, name: string) => tray(page).getByRole('button', { name, exact: true })

/** Drag with the mouse: press, move in steps, release over the target. */
async function drag(page: Page, from: Locator, to: Locator, hold = 0) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 })
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  if (hold) await page.waitForTimeout(hold)
  await page.mouse.up()
}

async function setUp(page: Page, request: Parameters<typeof signUpAndLogIn>[1]) {
  const { api } = await signUpAndLogIn(page, request)
  const binder = await api.location('Placing')
  await api.importList(LIST, binder)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/locations/${binder}`)
  await expect(page.getByTestId('binder')).toBeVisible()
  await showUnplaced(page)
  return { api, binder }
}

test.describe('Binder placing', () => {
  test('AC-12, AC-13: cards arrive unplaced; a copy leaving the binder frees its slot', async ({ page, request }) => {
    const { api, binder } = await setUp(page, request)
    await expect(page.getByTestId('unplaced-count')).toHaveText('4')
    await expect(tray(page).getByTestId('unplaced-quantity')).toHaveText(['×2'])

    const ring = (await api.get(`/api/locations/${binder}/binder/`)).items.find((r: { printing: { name: string } }) => r.printing.name === 'Sol Ring')
    await api.post(`/api/locations/${binder}/binder/move/`, { item: ring.id, to: { page: 1, row: 1, col: 1 } })
    await api.post(`/api/locations/${binder}/binder/move/`, { item: ring.id, to: { page: 1, row: 1, col: 2 } })
    await api.patch(`/api/items/${ring.id}/`, { quantity: 1 }) // the later slot frees
    await page.reload()
    await expect(slot(page, 1, 1)).toHaveAttribute('data-state', 'filled')
    await expect(slot(page, 1, 2)).toHaveAttribute('data-state', 'empty')

    const box = await api.location('Box', 'box')
    await api.patch(`/api/items/${ring.id}/`, { location: box })
    await page.reload()
    await expect(slot(page, 1, 1)).toHaveAttribute('data-state', 'empty')
  })

  test('AC-14: an empty slot adds a card there, or takes one from Unplaced', async ({ page, request }) => {
    await setUp(page, request)
    await slot(page, 1, 5).getByRole('button').click()
    await page.getByRole('menuitem', { name: 'Add card…' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Add card to page 1, row 2, column 2')
    await dialog.getByLabel('Card name').fill('counter')
    await dialog.getByTestId('card-results').getByRole('button', { name: 'Counterspell', exact: true }).click()
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(slot(page, 1, 5).getByRole('button')).toHaveAccessibleName('Page 1, slot 5: Counterspell')

    await slot(page, 1, 7).getByRole('button').click()
    await page.getByRole('menuitem', { name: 'From Unplaced…' }).click()
    await page.getByTestId('from-unplaced').getByRole('button', { name: 'Lightning Bolt' }).click()
    await expect(slot(page, 1, 7).getByRole('button')).toHaveAccessibleName('Page 1, slot 7: Lightning Bolt')
    await expect(page.getByTestId('unplaced-count')).toHaveText('3')
  })

  test('AC-15 to AC-17: drag from the tray, between slots and back; swap or share; the edge turns the page', async ({ page, request }) => {
    await setUp(page, request)
    await drag(page, trayCard(page, 'Lightning Bolt'), slot(page, 1, 1))
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Lightning Bolt')
    await drag(page, trayCard(page, 'Sol Ring'), slot(page, 1, 2))
    await expect(tray(page).getByTestId('unplaced-quantity')).toHaveCount(0) // one Sol Ring left

    // Slot to slot.
    await drag(page, slot(page, 1, 2), slot(page, 1, 9))
    await expect(slot(page, 1, 9).getByRole('button')).toHaveAccessibleName('Page 1, slot 9: Sol Ring')
    await expect(slot(page, 1, 2)).toHaveAttribute('data-state', 'empty')

    // Onto a taken slot: swap.
    await drag(page, slot(page, 1, 9), slot(page, 1, 1))
    await page.getByTestId('drop-choice').getByRole('button', { name: 'Swap' }).click()
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Sol Ring')
    await expect(slot(page, 1, 9).getByRole('button')).toHaveAccessibleName('Page 1, slot 9: Lightning Bolt')

    // Share, then the stack (AC-19).
    await drag(page, trayCard(page, 'Llanowar Elves'), slot(page, 1, 1))
    await page.getByTestId('drop-choice').getByRole('button', { name: 'Share slot' }).click()
    await expect(slot(page, 1, 1).getByTestId('stack-count')).toHaveText('+1')
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Llanowar Elves') // dropped last, on top

    // Back to the tray.
    await drag(page, slot(page, 1, 9), tray(page))
    await expect(slot(page, 1, 9)).toHaveAttribute('data-state', 'empty')
    await expect(trayCard(page, 'Lightning Bolt')).toBeVisible()

    // Holding at the right edge turns the page.
    const pages = page.getByTestId('binder-spread')
    const box = (await pages.boundingBox())!
    const from = (await trayCard(page, 'Lightning Bolt').boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 10 })
    await expect(page.getByTestId('binder-pages')).toHaveText('Page 2 of 2', { timeout: 3000 })
    await page.mouse.up()
  })

  test('AC-18, AC-19: Move to slot and Unplace from the menu; a shared slot lists its cards in order', async ({ page, request }) => {
    const { api, binder } = await setUp(page, request)
    const rows = (await api.get(`/api/locations/${binder}/binder/`)).items as { id: number; printing: { name: string } }[]
    const id = (name: string) => rows.find((r) => r.printing.name === name)!.id
    await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Sol Ring'), to: { page: 1, row: 1, col: 1 } })
    await api.post(`/api/locations/${binder}/binder/move/`, { item: id('Lightning Bolt'), to: { page: 1, row: 1, col: 1 }, mode: 'share' })
    await page.reload()

    await slot(page, 1, 1).getByRole('button').hover()
    await expect(page.getByTestId('stack-preview').getByTestId('card-preview')).toHaveCount(2)
    await slot(page, 1, 1).getByRole('button').click()
    const stack = page.getByTestId('stack-dialog')
    await expect(stack.getByTestId('stack-card')).toHaveText(['Lightning Bolt', 'Sol Ring'])
    await stack.getByRole('button', { name: 'Move Sol Ring up' }).click()
    await expect(stack.getByTestId('stack-card')).toHaveText(['Sol Ring', 'Lightning Bolt'])
    await page.keyboard.press('Escape')
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Sol Ring')

    await slot(page, 1, 1).getByRole('button').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Move to slot…' }).click()
    const move = page.getByTestId('move-to-slot')
    await move.getByLabel('Page').fill('2')
    await move.getByLabel('Row').fill('3')
    await move.getByLabel('Column').fill('1')
    await move.getByRole('button', { name: 'Move' }).click()
    await expect(slot(page, 1, 1).getByRole('button')).toHaveAccessibleName('Page 1, slot 1: Lightning Bolt')
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(slot(page, 2, 7).getByRole('button')).toHaveAccessibleName('Page 2, slot 7: Sol Ring')

    await slot(page, 2, 7).getByRole('button').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Unplace' }).click()
    await expect(slot(page, 2, 7)).toHaveAttribute('data-state', 'empty')
    await expect(page.getByTestId('unplaced-count')).toHaveText('3')
  })
})
