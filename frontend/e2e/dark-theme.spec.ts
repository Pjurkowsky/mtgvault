import { expect, test, type Page } from '@playwright/test'
import { choose, fixtureList, logOut, signUpAndLogIn, tile } from './helpers'

// Spec 022: Light, Dark or System theme, saved in this browser (AC-16, AC-17).
const dark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'))
/** Visible elements wider than 40 px with a light, opaque background (buttons excepted). */
const lightPanels = (page: Page) => page.evaluate(() => {
  // Colours come back as oklch() too: a canvas turns any CSS colour into RGBA.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  const rgba = (color: string) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    return ctx.getImageData(0, 0, 1, 1).data
  }
  const light: string[] = []
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
    if (el.closest('button, a, [data-slot="badge"], img, [role="option"]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 40 || rect.height < 16) continue
    const [r, g, b, a] = rgba(getComputedStyle(el).backgroundColor)
    if (a < 128) continue
    if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6) light.push(`${el.tagName}.${el.className}`.slice(0, 120))
  }
  return light
})
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.describe('Dark theme', () => {
  test('AC-16: System follows the device by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/login')
    expect(await dark(page)).toBe(true)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => dark(page)).toBe(false)
  })

  test('AC-16, AC-17: Dark in Settings applies at once, on reload and on Log in', async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await signUpAndLogIn(page, request)
    await page.goto('/settings')
    const light = await background(page)
    await choose(page, 'Theme', 'Dark')
    await expect.poll(() => dark(page)).toBe(true)
    expect(await background(page)).not.toBe(light)

    // The inline script alone sets it, before the app loads: no light flash.
    await page.route('**/src/main.ts', (route) => route.abort())
    await page.reload()
    expect(await dark(page)).toBe(true)
    await page.unroute('**/src/main.ts')

    await page.goto('/settings')
    await expect(page.getByTestId('theme-select')).toHaveText('Dark')
    await logOut(page)
    expect(await dark(page)).toBe(true)

    // Light wins over a dark device.
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.evaluate(() => localStorage.setItem('mtgvault.theme', 'light'))
    await page.reload()
    expect(await dark(page)).toBe(false)
  })
  test('AC-17: pages have no light panels in the dark theme', async ({ page, request }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: 'dark' })
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Binder')
    await api.importList(fixtureList(), binder)
    const deck = await api.deck('Goblins', 'commander', {
      text: 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Dockside Extortionist\n1 Cloudstone Curio\n1 Sol Ring\n\nMaybeboard\n1 Smothering Tithe',
    })
    const pages = ['/cards', `/locations/${binder}`, '/decks', '/wants', '/settings', '/users',
      ...['', '?layout=list', '?layout=visual', '?tab=swaps', '?tab=combos', '?tab=stats'].map((q) => `/decks/${deck.id}${q}`)]
    for (const path of pages) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(await lightPanels(page), path).toEqual([])
    }
    await page.goto('/cards')
    await tile(page, 'Sol Ring').first().click()
    await page.waitForLoadState('networkidle')
    expect(await lightPanels(page), 'card dialog').toEqual([])
  })
})
