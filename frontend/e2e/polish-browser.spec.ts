import { expect, test } from '@playwright/test'
import { more, signUpAndLogIn, tile } from './helpers'

const LIST = '1 Sol Ring (C21) 263\n2 Lightning Bolt (MSC) 806\n1 Counterspell (FDC) 61'
const opacity = (locator: import('@playwright/test').Locator) => locator.evaluate((el) => getComputedStyle(el).opacity)

test.describe('Card browser (spec 002)', () => {
  test.beforeEach(async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList(LIST)
    await page.goto('/cards')
    await expect(tile(page, 'Sol Ring')).toBeVisible()
  })

  test('AC-12, AC-13, AC-15: hover checkbox; once selected, all checkboxes show and clicks toggle', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: 'Select Sol Ring' })
    await expect.poll(() => opacity(box)).toBe('0')
    await tile(page, 'Sol Ring').hover()
    await expect.poll(() => opacity(box)).toBe('1')
    await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)

    await box.click()
    await expect(page.getByTestId('selection-bar')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect.poll(() => opacity(page.getByRole('checkbox', { name: 'Select Counterspell' }))).toBe('1')
    await tile(page, 'Counterspell').click()
    await expect(page.getByTestId('selected-count')).toHaveText('2 selected')
    await expect(page.getByTestId('card-detail')).toHaveCount(0)
  })

  test('AC-14: Select all in the bulk bar and the table header', async ({ page }) => {
    await expect(page.getByTestId('select-all')).toHaveCount(0) // not in the toolbar
    await page.getByRole('checkbox', { name: 'Select Sol Ring' }).click()
    const barAll = page.getByTestId('selection-bar').getByTestId('select-all')
    await expect(barAll).toHaveAttribute('data-state', 'indeterminate')
    await barAll.click()
    await expect(barAll).toHaveAttribute('data-state', 'checked')
    await expect(page.getByTestId('selected-count')).toHaveText('3 selected')
    await barAll.click()
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)

    await page.getByLabel('Table view').click()
    const header = page.getByTestId('select-all-header')
    await expect(header).toHaveAttribute('data-state', 'unchecked')
    await header.click()
    await expect(page.getByTestId('selected-count')).toHaveText('3 selected')
    await expect(header).toHaveAttribute('data-state', 'checked')
    await header.click()
    await expect(page.getByTestId('selection-bar')).toHaveCount(0)
  })

  test('AC-16, AC-17: click opens the card; name and price only on hover', async ({ page }) => {
    const overlay = tile(page, 'Sol Ring').getByTestId('card-hover')
    await expect.poll(() => opacity(overlay)).toBe('0')
    await tile(page, 'Sol Ring').hover()
    await expect.poll(() => opacity(overlay)).toBe('1')
    await expect(overlay).toContainText('Sol Ring')
    await expect(overlay).toContainText('€0.91')
    await tile(page, 'Sol Ring').click()
    await expect(page.getByTestId('card-detail')).toBeVisible()
  })

  test('AC-18: right-click menu: Open, Edit, Add to deck (spec 004), Delete', async ({ page }) => {
    await tile(page, 'Lightning Bolt').click({ button: 'right' })
    await expect(page.getByTestId('card-menu').getByRole('menuitem')).toHaveText(['Open', 'Edit', 'Add to deck', 'Delete'])
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await page.getByTestId('edit-dialog').getByLabel('Quantity').fill('7')
    await page.getByTestId('edit-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×7')

    await tile(page, 'Lightning Bolt').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open' }).click()
    await expect(page.getByTestId('card-detail').getByRole('heading', { name: 'Lightning Bolt' })).toBeVisible()
  })

  test('AC-19, AC-22: Import and Export in the More menu, with tooltips on icon buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(0)
    await page.getByRole('button', { name: 'More' }).hover()
    await expect(page.getByRole('tooltip').filter({ hasText: 'More' })).toBeVisible()
    await more(page, 'Export')
    await expect(page.getByTestId('export-text')).toHaveValue(/Sol Ring/)
  })

  test('AC-20, AC-21: mana symbols; Clear in the filter menu; no chips', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    const panel = page.getByTestId('filter-panel')
    for (const color of ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless']) {
      await expect(panel.getByRole('button', { name: color }).locator('img')).toBeVisible()
    }
    await expect(panel.getByRole('button', { name: 'Clear' })).toBeDisabled()
    await panel.getByRole('button', { name: 'Red' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Filters' })).toContainText('1')
    await expect(page.getByTestId('filter-chips')).toHaveCount(0)
    await expect(page.getByTestId('browser-summary')).toContainText('2 cards')

    await page.getByRole('button', { name: 'Filters' }).click()
    await panel.getByRole('button', { name: 'Clear' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('browser-summary')).toContainText('4 cards')
  })

  test('AC-23: the summary reads "N cards · value"', async ({ page }) => {
    // 0.91 + 2 × 1.91 + 3.36 = 8.09
    await expect(page.getByTestId('browser-summary')).toHaveText('4 cards · €8.09')
  })
})

test('AC-18a: Edit can change the printing, with a hover preview; a match merges', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await api.importList('2 Lightning Bolt (MSC) 806\n1 Lightning Bolt (FDC) 163')
  await page.goto('/cards?sort=set')
  await tile(page, 'Lightning Bolt').last().click({ button: 'right' }) // MSC sorts after FDC
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const dialog = page.getByTestId('edit-dialog')
  await expect(dialog.getByRole('radio', { checked: true })).toHaveAccessibleName(/#806$/)
  await dialog.getByRole('radio', { name: / #163$/ }).hover()
  await expect(page.getByTestId('card-preview')).toBeVisible()
  await dialog.getByRole('radio', { name: / #163$/ }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved. It matched another row, so the two merged.')).toBeVisible()
  await expect(tile(page, 'Lightning Bolt')).toHaveCount(1)
  await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×3')
})
