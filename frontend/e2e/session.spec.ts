import { expect, test } from '@playwright/test'
import { logOut, signUp, uniqueUser } from './helpers'

test.describe('Session', () => {
  test('AC-9: stays logged in after reload and in a new tab', async ({ page, context }) => {
    const user = uniqueUser('sess')
    await signUp(page, user)

    await page.reload()
    await expect(page.getByTestId('user-menu')).toHaveText(user.username)

    const tab = await context.newPage()
    await tab.goto('/settings')
    await expect(tab.getByTestId('settings-username')).toHaveText(user.username)
  })

  test('AC-9: the refresh cookie is httpOnly and lasts 7 days', async ({ page, context }) => {
    await signUp(page, uniqueUser('cookie'))
    const cookie = (await context.cookies()).find((c) => c.name === 'refresh')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.path).toBe('/api/auth/')
    const days = ((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThanOrEqual(7)
  })

  test('AC-10: log out ends the session on this device', async ({ page }) => {
    await signUp(page, uniqueUser('out'))
    await logOut(page)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await page.goto('/')
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)$/)

    const refresh = await page.request.post('/api/auth/refresh/')
    expect(refresh.status()).toBe(401)
  })
})
