import { expect, test } from '@playwright/test'
import { logIn, logOut, pickCurrency, signUp, uniqueUser } from './helpers'

test.describe('Settings', () => {
  test('AC-12: shows username, email and currency', async ({ page }) => {
    const user = uniqueUser('set')
    await signUp(page, user)
    await page.goto('/settings')

    await expect(page.getByTestId('settings-username')).toHaveText(user.username)
    await expect(page.getByTestId('settings-email')).toHaveText(user.email)
    await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveText('Euro (EUR)')
  })

  test('AC-13: currency change applies right away and persists', async ({ page }) => {
    await signUp(page, uniqueUser('cur'))
    await page.goto('/settings')

    await pickCurrency(page, 'PLN')
    await expect(page.getByText('Currency changed to PLN.')).toBeVisible()
    await expect(page.getByText('converted from EUR')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveText('Polish Złoty (PLN)')
  })

  test('AC-14: change password with the current one', async ({ page }) => {
    const user = uniqueUser('pw')
    const newPassword = 'another-horse-77'
    await signUp(page, user)
    await page.goto('/settings')

    await page.getByLabel('Current password').fill('not-my-password')
    await page.getByLabel('New password').fill(newPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Current password is wrong.')).toBeVisible()

    await page.getByLabel('Current password').fill(user.password)
    await page.getByLabel('New password').fill('1234')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('This password is too common.')).toBeVisible()

    await page.getByLabel('New password').fill(newPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Password changed.')).toBeVisible()

    await logOut(page)
    await logIn(page, user.username, user.password)
    await expect(page.getByTestId('login-error')).toBeVisible()
    await logIn(page, user.username, newPassword)
    await expect(page.getByTestId('user-menu')).toHaveText(user.username)
  })
})
