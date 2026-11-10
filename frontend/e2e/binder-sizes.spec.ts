import { expect, test } from '@playwright/test'
import { binderSlot as slot, signUpAndLogIn } from './helpers'

// Spec 021: bigger pockets (AC-3) and Fit (AC-4).
const width = async (l: ReturnType<typeof slot>) => (await l.boundingBox())!.width

test.describe('Binder sizes', () => {
  test('AC-3: S, M and L pockets are 5, 7 and 9.5 rem', async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Sizes')
    await page.goto(`/locations/${binder}`)
    for (const [name, px] of [['Small cards', 80], ['Medium cards', 112], ['Large cards', 152]] as const) {
      await page.getByRole('button', { name }).click()
      await expect.poll(() => width(slot(page, 1, 1))).toBe(px)
    }
  })

  test('AC-4: Fit fills the window, spreads when two pages fit, one page on a phone; remembered', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 1000 })
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Fit')
    // A card on page 3, so pages 2 and 3 face each other.
    await api.importList('1 Sol Ring (C21) 263', binder)
    const item = (await api.get(`/api/locations/${binder}/binder/`)).items[0].id
    await api.post(`/api/locations/${binder}/binder/move/`, { item, to: { page: 3, row: 1, col: 1 } })
    await page.goto(`/locations/${binder}?page=2`)
    await page.getByRole('button', { name: 'Fit to window' }).click()
    await expect(page.getByTestId('binder-page')).toHaveCount(2)
    // The spread fits the window: the pages end just above the pagination, pockets beat M.
    await expect.poll(() => width(slot(page, 2, 1))).toBeGreaterThan(112)
    await page.screenshot({ path: 'test-results/binder-fit.png' })
    for (const p of await page.getByTestId('binder-page').all()) {
      const box = (await p.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(1000)
      expect(box.y + box.height).toBeGreaterThan(850)
    }
    const spread = (await page.getByTestId('binder-spread').boundingBox())!
    const pages = await page.getByTestId('binder-page').all()
    const right = (await pages[1]!.boundingBox())!
    expect(right.x + right.width).toBeLessThanOrEqual(spread.x + spread.width + 1)

    // A taller window lets the pockets grow.
    const before = await width(slot(page, 2, 1))
    await page.setViewportSize({ width: 1800, height: 1300 })
    await expect.poll(() => width(slot(page, 2, 1))).toBeGreaterThan(before)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Fit to window' })).toHaveAttribute('data-state', 'on')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
    const phone = (await page.getByTestId('binder-page').boundingBox())!
    expect(phone.x + phone.width).toBeLessThanOrEqual(390)
  })
})
