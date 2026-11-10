import { expect, test, type Page } from '@playwright/test'
import { choose, logOut, signUpAndLogIn } from './helpers'

// Spec 022: Light, Dark or System theme, saved in this browser (AC-16, AC-17).
const dark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'))
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
})
