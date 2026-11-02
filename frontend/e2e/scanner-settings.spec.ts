import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 003 AC-12, AC-15, AC-16. The settings sheet works without a camera.
test('AC-12, AC-15: scanner settings sheet saves to the account', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await page.goto('/scan')
  await page.getByRole('button', { name: 'Scanner settings' }).click()
  const sheet = page.getByTestId('scanner-settings')
  await expect(sheet.getByRole('switch', { name: 'Sounds' })).toBeChecked()
  await expect(sheet.getByRole('switch', { name: 'Running total' })).toBeChecked()
  await expect(sheet.getByLabel('Ding from (EUR)', { exact: true })).toHaveValue('1')
  await expect(sheet.getByLabel('Big ding from (EUR)')).toHaveValue('10')

  await sheet.getByRole('switch', { name: 'Sounds' }).click()
  await sheet.getByLabel('Ding from (EUR)', { exact: true }).fill('2.5')
  await sheet.getByLabel('Ding from (EUR)', { exact: true }).blur()
  await sheet.getByLabel('Big ding from (EUR)').fill('1')
  await sheet.getByLabel('Big ding from (EUR)').blur()
  await expect(sheet.getByText('The high threshold must be at least the low one.')).toBeVisible()
  await sheet.getByLabel('Big ding from (EUR)').fill('25')
  await sheet.getByLabel('Big ding from (EUR)').blur()
  await sheet.getByLabel('Locked sets').fill('Modern Horizons 2')
  await sheet.getByRole('checkbox').first().click()
  await expect(sheet.getByTestId('locked-sets')).toContainText('mh2')

  await expect.poll(async () => api.get('/api/scanner/settings/')).toMatchObject({
    sounds: false, ding_low: 2.5, ding_high: 25, locked_sets: ['mh2'],
  })
  await page.reload()
  await page.getByRole('button', { name: 'Scanner settings' }).click()
  await expect(page.getByTestId('locked-sets')).toContainText('mh2')
  await expect(page.getByTestId('scanner-settings').getByRole('switch', { name: 'Sounds' })).not.toBeChecked()
})

test('AC-16: Fast scanning is an account setting on the Settings page', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await page.goto('/settings')
  const toggle = page.getByRole('switch', { name: 'Fast scanning' })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(page.getByText('Fast scanning on.')).toBeVisible()
  expect((await api.get('/api/scanner/settings/')).fast).toBe(true)
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Fast scanning' })).toBeChecked()
})
