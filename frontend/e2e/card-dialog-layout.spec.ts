import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn, tile } from './helpers'

// Spec 023: the card dialog layout (AC-10 to AC-13). EDHREC data comes from
// backend/cards/fixtures/edhrec/sol-ring.json. AC-14 (everything still works) is proved by
// card-detail, card-dialog-polish, deck-* and wants tests, which run against this layout.
const detail = (page: Page) => page.getByTestId('card-detail')
const y = async (page: Page, id: string) => (await page.getByTestId(id).first().boundingBox())!.y

async function openSolRing(page: Page, request: Parameters<typeof signUpAndLogIn>[1]) {
  const { api } = await signUpAndLogIn(page, request)
  await api.importList('1 Sol Ring (C21) 263')
  await page.goto('/cards')
  await tile(page, 'Sol Ring').click()
  await detail(page).getByRole('tab', { name: 'Played with' }).click()
  await expect(page.getByTestId('played-with-group').first()).toBeVisible()
}

test.describe('Card dialog layout', () => {
  test('AC-10 to AC-12: two columns, the right one scrolls under sticky group pills; 10 a group; lift', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await openSolRing(page, request)

    // Two columns: image left, copies then tabs right; the dialog fits the window.
    const left = (await page.getByTestId('detail-left').boundingBox())!
    const right = (await page.getByTestId('detail-right').boundingBox())!
    expect(left.x + left.width).toBeLessThan(right.x)
    expect(await y(page, 'copies')).toBeLessThan(await y(page, 'edhrec-played-with'))
    const dialog = (await detail(page).boundingBox())!
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(900)

    // The right column scrolls by itself; the image stays put and the pills stay on top.
    const image = await y(page, 'detail-image')
    const column = page.getByTestId('detail-right')
    await column.evaluate((el) => (el.scrollTop = 800))
    expect(await column.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    expect(await y(page, 'detail-image')).toBe(image)
    const pills = page.getByTestId('group-pills')
    expect(Math.abs((await pills.boundingBox())!.y - right.y)).toBeLessThan(4)

    // A pill scrolls to its group, just under the pills.
    const groups = page.getByTestId('played-with-group')
    const last = Math.min(2, (await groups.count()) - 1) // a middle group: the last one may not reach the top
    const name = (await groups.nth(last).getByRole('heading').textContent())!
    await column.evaluate((el) => (el.scrollTop = 0))
    await pills.getByRole('button', { name, exact: true }).click()
    await expect.poll(async () => {
      const heading = (await groups.nth(last).getByRole('heading').boundingBox())!
      const bar = (await pills.boundingBox())!
      return heading.y >= bar.y + bar.height - 2 && heading.y < bar.y + bar.height + 80
    }).toBe(true)

    // 10 cards a group, Show all for the rest.
    const counts = await groups.evaluateAll((els) => els.map((e) => e.querySelectorAll('[data-testid=edhrec-card]').length))
    const withMore = await groups.evaluateAll((els) => els.findIndex((e) => [...e.querySelectorAll('button')].some((b) => b.textContent?.startsWith('Show all'))))
    expect(counts.every((n) => n <= 10)).toBe(true)
    const big = groups.nth(withMore)
    await big.getByRole('button', { name: /^Show all/ }).click()
    expect(await big.getByTestId('edhrec-card').count()).toBeGreaterThan(10)

    // AC-12: synergy reads as lift; commanders keep their deck share.
    await expect(page.getByTestId('lift').first()).toHaveText(/^lift \d+\.\d\d$/)
    await detail(page).getByRole('tab', { name: 'Commanders' }).click()
    await expect(page.getByTestId('edhrec-commanders')).toContainText('% of decks')
  })

  test('AC-13: on phones one column: image, price, section, printings, then tabs; pills stay on top', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSolRing(page, request)
    const order = ['detail-image', 'detail-image-price', 'copies', 'reprints', 'edhrec-played-with']
    const ys = []
    for (const id of order) ys.push(await y(page, id))
    expect(ys).toEqual([...ys].sort((a, b) => a - b))

    await detail(page).evaluate((el) => (el.scrollTop = 1500))
    const pills = (await page.getByTestId('group-pills').boundingBox())!
    const dialog = (await detail(page).boundingBox())!
    expect(pills.y).toBeGreaterThanOrEqual(dialog.y - 2)
    expect(pills.y).toBeLessThan(dialog.y + 40)
  })
})
