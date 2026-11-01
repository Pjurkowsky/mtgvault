import { expect, test } from '@playwright/test'
import { createUser, uniqueUser } from './helpers'

test.describe('Public profile', () => {
  const user = uniqueUser('prof')

  test.beforeAll(async ({ request }) => {
    await createUser(request, user)
  })

  test('AC-15: anyone can open a profile while logged out', async ({ page }) => {
    await page.goto(`/u/${user.username}`)
    await expect(page.getByTestId('profile-username')).toHaveText(user.username)
    await expect(page.getByText(/^Joined /)).toBeVisible()
  })

  test('AC-15: profile URL ignores letter case', async ({ page }) => {
    await page.goto(`/u/${user.username.toUpperCase()}`)
    await expect(page.getByTestId('profile-username')).toHaveText(user.username)
  })

  test('AC-16: unknown user shows "User not found"', async ({ page }) => {
    await page.goto('/u/nobody_by_this_name')
    await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible()
  })

  test('AC-17: no private data on the page or in the API', async ({ page, request }) => {
    await page.goto(`/u/${user.username}`)
    await expect(page.getByTestId('profile-username')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(user.email)
    await expect(page.locator('body')).not.toContainText(user.currency)

    const response = await request.get(`/api/users/${user.username}/`)
    expect(Object.keys(await response.json()).sort()).toEqual(['date_joined', 'username'])
  })
})
