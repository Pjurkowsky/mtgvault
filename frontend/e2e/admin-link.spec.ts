import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { signUp, uniqueUser } from './helpers'

// Spec 008, AC-20: admins get an Admin item in the account menu.
test('AC-20: the Admin item shows only for staff and opens /admin/', async ({ page }) => {
  const user = uniqueUser('admin')
  await signUp(page, user)
  await page.getByTestId('user-menu').click()
  await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  execFileSync('uv', ['run', 'manage.py', 'shell', '-c',
    `from users.models import User; User.objects.filter(username='${user.username}').update(is_staff=True)`],
  { cwd: '../backend', env: { ...process.env, DATABASE_URL } })

  await page.reload()
  await page.getByTestId('user-menu').click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin/')
})
