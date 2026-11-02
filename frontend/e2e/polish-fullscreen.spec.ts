import { expect, test } from '@playwright/test'
import { signUpAndLogIn, tile } from './helpers'

// Spec 002 AC-18b: an expand button opens any card full screen; Escape closes only the preview.
const fullscreen = (page: import('@playwright/test').Page) => page.getByTestId('fullscreen')

test.describe('Full-screen card preview', () => {
  test('Add card: search results and printings', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.goto('/cards')
    await page.getByRole('button', { name: 'Add card' }).click()
    await page.getByLabel('Card name').fill('sol ring')
    const result = page.getByTestId('card-results').getByRole('listitem').first()
    await result.hover()
    await result.getByRole('button', { name: 'Preview Sol Ring' }).click()
    await expect(fullscreen(page).getByRole('img', { name: 'Sol Ring' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(fullscreen(page)).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Add card' })).toBeVisible()

    await page.getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).click()
    const printing = page.getByTestId('printing-picker').locator('.group').first()
    await printing.hover()
    await printing.getByTestId('expand').click()
    await expect(fullscreen(page)).toBeVisible()
    await fullscreen(page).click()
    await expect(fullscreen(page)).toHaveCount(0)
    await expect(page.getByTestId('printing-picker')).toBeVisible()
  })

  test('Edit: printings', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Lightning Bolt (MSC) 806')
    await page.goto('/cards')
    await tile(page, 'Lightning Bolt').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const printing = page.getByTestId('edit-dialog').getByTestId('printing-picker').locator('.group').nth(2)
    await printing.hover()
    await printing.getByTestId('expand').click()
    await expect(fullscreen(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('edit-dialog')).toBeVisible()
  })

  test('Card detail: big image, reprints and EDHREC cards', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await page.getByRole('button', { name: 'Preview Sol Ring' }).first().click()
    await expect(fullscreen(page).getByRole('img', { name: 'Sol Ring' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('card-detail')).toBeVisible()

    await page.getByTestId('card-detail').getByRole('tab', { name: 'Played with' }).click()
    const card = page.getByTestId('edhrec-played-with').locator('li').filter({ has: page.getByRole('button', { name: 'Rhystic Study', exact: true }) })
    await card.hover()
    await card.getByRole('button', { name: 'Preview Rhystic Study' }).click()
    await expect(fullscreen(page).getByRole('img', { name: 'Rhystic Study' })).toBeVisible()
    await page.keyboard.press('Escape')
    // Clicking the card itself still opens it
    await card.getByRole('button', { name: 'Rhystic Study', exact: true }).click()
    await expect(page.getByTestId('card-detail').getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()
  })
})
