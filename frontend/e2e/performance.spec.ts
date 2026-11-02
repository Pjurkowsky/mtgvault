import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { fixtureList, more, signUpAndLogIn } from './helpers'

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

test('AC-36: with 20,000 rows, results show within 1 s of changing search, filter or sort', async ({ page, request }) => {
  const { user } = await signUpAndLogIn(page, request)
  execSync(`uv run manage.py seed_items --username ${user.username} --rows 20000`, {
    cwd: '../backend', env: { ...process.env, DATABASE_URL, DEBUG: 'True' }, stdio: 'pipe',
  })
  await page.goto('/cards')
  const summary = page.getByTestId('browser-summary')
  await expect(summary).toContainText(/\d+ cards/)

  // Each change must update what's shown within 1 s: the summary for search and
  // filters, the first card for sorting.
  const firstCard = page.getByTestId('card-tile').first().locator('img')
  const timed = async (label: string, action: () => Promise<void>, watch: 'summary' | 'first' = 'summary') => {
    const read = () => (watch === 'summary' ? summary.innerText() : firstCard.getAttribute('src'))
    const before = await read()
    const start = Date.now()
    await action()
    await expect.poll(read, { intervals: [25] }).not.toBe(before)
    await expect(page.getByTestId('card-tile').first()).toBeVisible()
    const elapsed = Date.now() - start
    console.log(`${label}: ${elapsed} ms`)
    expect(elapsed, label).toBeLessThan(1000)
  }

  await timed('search', () => page.getByLabel('Search cards').fill('bolt'))
  await timed('filter', async () => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByTestId('filter-panel').getByRole('checkbox', { name: 'Uncommon' }).click()
  })
  await page.keyboard.press('Escape')
  await timed('sort', async () => {
    await page.getByRole('combobox', { name: 'Sort by' }).click()
    await page.getByRole('option', { name: 'Price' }).click()
  }, 'first')
})

test('AC-50: a 5,000-line import works', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  const lines = fixtureList().split('\n')
  const list = Array.from({ length: 5000 }, (_, i) => lines[i % lines.length]).join('\n')
  await page.goto('/cards')
  await more(page, 'Import')
  await page.getByLabel('Card list').fill(list)
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('button', { name: 'Import 5000 cards' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Import 5000 cards' }).click()
  await expect(page.getByText('Imported 5000 cards.')).toBeVisible({ timeout: 60_000 })
  const items = await api.get('/api/items/')
  expect(items.total_quantity).toBe(5000)
  expect(items.count).toBe(lines.length)
})
