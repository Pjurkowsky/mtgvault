import { expect, test } from '@playwright/test'
import { createUser, logIn, uniqueUser } from './helpers'

test.describe('Log in', () => {
  const user = uniqueUser('login')

  test.beforeAll(async ({ request }) => {
    await createUser(request, user)
  })

  test('AC-7: log in with username', async ({ page }) => {
    await page.goto('/login')
    await logIn(page, user.username, user.password)
    await expect(page.getByTestId('user-menu')).toHaveText(user.username)
  })

  test('AC-7: log in with email, any letter case', async ({ page }) => {
    await page.goto('/login')
    await logIn(page, user.email.toUpperCase(), user.password)
    await expect(page.getByTestId('user-menu')).toHaveText(user.username)
  })

  test('AC-8: wrong password and unknown user get the same generic message', async ({ page }) => {
    await page.goto('/login')
    await logIn(page, user.username, 'wrong-password-1')
    const error = page.getByTestId('login-error')
    await expect(error).toHaveText('Wrong username/email or password.')

    await logIn(page, 'nobody_here_at_all', user.password)
    await expect(error).toHaveText('Wrong username/email or password.')
  })

  test('AC-11: a protected page redirects to login, then back after login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)settings$/)

    await logIn(page, user.username, user.password)
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('AC-11: next only follows local paths', async ({ page }) => {
    await page.goto('/login?next=//evil.example.com')
    await logIn(page, user.username, user.password)
    await expect(page).toHaveURL(/localhost:\d+\/$/)
  })
})
