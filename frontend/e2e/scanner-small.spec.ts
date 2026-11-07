import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 017: the scanner on a 320px phone, and sounds that play whole (AC-1 to AC-5).
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000

/** The top bar fits one row with close and settings on screen (AC-1). */
async function expectTopBarFits(page: Page) {
  const close = (await page.getByRole('button', { name: 'Close scanner' }).boundingBox())!
  const settings = page.getByRole('button', { name: 'Scanner settings' })
  await expect(settings).toBeInViewport({ ratio: 1 })
  const gear = (await settings.boundingBox())!
  expect(Math.abs(gear.y - close.y)).toBeLessThan(2) // same row
  const link = (await page.getByTestId('cart-link').boundingBox())!
  expect(link.height).toBeLessThan(44) // one line
  expect(link.x + link.width).toBeLessThanOrEqual(gear.x)
}

test.describe('Scanner on a small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('AC-1 to AC-3: one-row top bar in deck and binder modes, compact result bar, full screen', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('My Very Long Commander Deck Name', 'commander', { create_box: true, text: 'Deck\n1 Sol Ring' })
    await page.goto(`/scan?deck=${deck.id}`)
    await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
    await expectTopBarFits(page)
    await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeInViewport({ ratio: 1 })
    expect((await page.getByTestId('scanner').boundingBox())!.width).toBe(320) // AC-3

    const binder = await api.location('A Big Red Binder For Trades')
    await page.goto(`/scan?location=${binder}&page=1&row=2&col=2`)
    const bar = page.getByTestId('result-bar')
    await expect(bar).toBeVisible({ timeout: LOG_TIMEOUT })
    await expectTopBarFits(page)

    // AC-2: icon buttons, one row of actions.
    const plus = (await bar.getByRole('button', { name: '1' }).boundingBox())!
    for (const name of ['Change printing', 'Undo']) {
      const button = bar.getByRole('button', { name })
      expect(Math.abs((await button.boundingBox())!.y - plus.y)).toBeLessThan(2)
      await page.mouse.move(0, 300) // let the previous tooltip close
      await button.hover()
      await expect(page.getByRole('tooltip').filter({ hasText: name }).first()).toBeAttached()
    }
  })
})

test('AC-4, AC-5: sounds start with audio running, without a tap in the scanner', async ({ page, request }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __starts: string[] }
    w.__starts = []
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (this: OscillatorNode, when?: number) {
      w.__starts.push(`${this.context.state}:${when! >= this.context.currentTime}`)
      return start.call(this, when)
    }
  })
  await signUpAndLogIn(page, request)
  await page.goto('/cards')
  await page.getByRole('button', { name: 'Scan cards' }).click() // the only tap
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __starts: string[] }).__starts)).toContain('running:true')
  const starts = await page.evaluate(() => (window as unknown as { __starts: string[] }).__starts)
  expect(starts.every((s) => s === 'running:true')).toBe(true)
})
