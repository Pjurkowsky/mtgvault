import { expect, test } from '@playwright/test'
import { createUser, fillSignUp, signUp, uniqueUser } from './helpers'

test.describe('Sign up', () => {
  test('AC-1: all four fields are required', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Enter a username.')).toBeVisible()
    await expect(page.getByText('Enter your email.')).toBeVisible()
    await expect(page.getByText('Enter a password.')).toBeVisible()
    await expect(page.getByText('Choose a currency.')).toBeVisible()
    await expect(page).toHaveURL(/\/signup$/)
  })

  test('AC-2: currency offers USD, EUR, PLN with nothing preselected; PLN shows a note', async ({ page }) => {
    await page.goto('/signup')
    const currency = page.getByRole('combobox', { name: 'Currency' })
    await expect(currency).toHaveText('Choose a currency')

    await currency.click()
    await expect(page.getByRole('option')).toHaveText(['US Dollar (USD)', 'Euro (EUR)', 'Polish Złoty (PLN)'])
    await page.getByRole('option', { name: 'Polish Złoty (PLN)' }).click()
    await expect(page.getByText('converted from EUR')).toBeVisible()
  })

  test('AC-3: username must follow the rules', async ({ page }) => {
    const user = { ...uniqueUser(), username: 'ab' }
    await fillSignUp(page, user)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Use 3 to 30 characters')).toBeVisible()

    await page.getByLabel('Username').fill('no spaces')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Use 3 to 30 characters')).toBeVisible()
  })

  test('AC-3: usernames are unique ignoring case', async ({ page, request }) => {
    const existing = uniqueUser()
    await createUser(request, existing)

    await fillSignUp(page, { ...uniqueUser(), username: existing.username.toUpperCase() })
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('This username is taken.')).toBeVisible()
  })

  test('AC-4: emails are unique ignoring case', async ({ page, request }) => {
    const existing = uniqueUser()
    await createUser(request, existing)

    await fillSignUp(page, { ...uniqueUser(), email: existing.email.toUpperCase() })
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('An account with this email already exists.')).toBeVisible()
  })

  test('AC-5: each failed password rule shows under the password field', async ({ page }) => {
    await fillSignUp(page, { ...uniqueUser(), password: '1234' })
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('This password is too short.', { exact: false })).toBeVisible()
    await expect(page.getByText('This password is too common.')).toBeVisible()
    await expect(page.getByText('This password is entirely numeric.')).toBeVisible()
  })

  test('AC-6: after sign-up the user is logged in on their collection', async ({ page }) => {
    const user = uniqueUser()
    await signUp(page, user)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('tab', { name: 'Locations' })).toBeVisible()
  })
})
