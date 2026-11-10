import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 021: pages use the whole window (AC-1); columns grow with it (AC-2).
const LIST = 'Deck\n1 Sol Ring (C21) 263\n1 Lightning Bolt (FDC) 163\n1 Counterspell (FDC) 152\n1 Brainstorm (FDC) 148\n1 Island (FDN) 271\n1 Shivan Dragon (FDN) 208'
const columnCount = (page: Page, testid: string) =>
  page.getByTestId(testid).evaluate((el) => getComputedStyle(el).columnCount)

test.describe('Layout width', () => {
  test('AC-1: wide pages fill the window; Settings stays narrow', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 900 })
    await signUpAndLogIn(page, request)
    await page.goto('/')
    // The window less a scrollbar, if any.
    expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(1780)
    expect((await page.locator('header > div').boundingBox())!.width).toBeGreaterThan(1780)
    // 24 px gutter from 640 px up.
    expect(await page.locator('main').evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('24px')

    await page.goto('/settings')
    const settings = await page.locator('main > div').first().boundingBox()
    expect(settings!.width).toBeLessThanOrEqual(576)

    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')
    expect(await page.locator('main').evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('16px')
  })

  test('AC-2: Text and List views add columns as the window widens', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Wide', 'casual', { text: LIST })
    for (const [width, text, list] of [[1100, '3', '2'], [1300, '4', '2'], [1600, '5', '3']] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/decks/${deck.id}?layout=text`)
      expect(await columnCount(page, 'deck-text')).toBe(text)
      await page.goto(`/decks/${deck.id}?layout=list`)
      expect(await columnCount(page, 'deck-list')).toBe(list)
    }
    // The collection grid: 5 tiles a row at 1024 px, 8 at 1536 px.
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/locations/unfiled?view=grid')
    const tracks = () => page.getByTestId('card-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(await tracks()).toBe(8)
    await page.setViewportSize({ width: 1100, height: 900 })
    expect(await tracks()).toBe(5)
  })
})
