import { expect, test, type Page } from '@playwright/test'
import { more, signUpAndLogIn } from './helpers'

// Spec 014: export options and a steady layout (AC-1 to AC-6).
// Real scrollbars, as on a desktop browser (AC-1).
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const text = (page: Page) => page.getByTestId('export-text')
const option = (page: Page, name: string) => page.getByTestId('export-options').getByRole('checkbox', { name })

async function deckMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

test.describe('Export options', () => {
  test('AC-2, AC-3, AC-6: collection export without printings merges names; fixed box; remembered', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263\n2 Lightning Bolt (FDC) 163\n1 Lightning Bolt (MSC) 806 *F*')
    await page.goto('/cards')
    await more(page, 'Export')
    const dialog = page.getByRole('dialog')
    await expect(text(page)).toHaveValue(/1 Lightning Bolt \(MSC\) 806 \*F\*/)
    await expect(dialog.getByText('3 rows')).toBeVisible()
    await expect.poll(() => dialog.evaluate((d) => d.getAnimations().length)).toBe(0) // opened
    const box = (await text(page).boundingBox())!
    expect(await text(page).getAttribute('wrap')).toBe('off')

    await option(page, 'Printings').click()
    await expect(text(page)).toHaveValue(/^(3 Lightning Bolt\n1 Sol Ring|1 Sol Ring\n3 Lightning Bolt)\n$/)
    await expect(dialog.getByText('2 rows')).toBeVisible()
    const after = (await text(page).boundingBox())!
    expect([after.width, after.height]).toEqual([box.width, box.height])

    // Remembered for the next export.
    await page.reload()
    await more(page, 'Export')
    await expect(option(page, 'Printings')).not.toBeChecked()
    await expect(text(page)).not.toHaveValue(/\(/)
  })

  test('AC-3, AC-4: deck Export drops printings and categories on request', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tags', 'casual', { text: 'Deck\n1 Sol Ring (C21) 263 #Ramp\n1 Forest (M21) 272' })
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Export')
    await expect(text(page)).toHaveValue('Deck\n1 Forest (M21) 272\n1 Sol Ring (C21) 263 #Ramp\n')
    await option(page, 'Categories').click()
    await expect(text(page)).toHaveValue('Deck\n1 Forest (M21) 272\n1 Sol Ring (C21) 263\n')
    await option(page, 'Printings').click()
    await expect(text(page)).toHaveValue('Deck\n1 Forest\n1 Sol Ring\n')
    await option(page, 'Categories').click()
    await expect(text(page)).toHaveValue('Deck\n1 Forest\n1 Sol Ring #Ramp\n')
  })

  test('AC-5: Export missing includes cards in other decks unless unticked', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const other = await api.deck('Other', 'casual', { create_box: true, text: '1 Counterspell (FDC) 61' })
    await api.importList('1 Counterspell (FDC) 61', other.location)
    const deck = await api.deck('Short', 'casual', { text: 'Deck\n1 Counterspell (FDC) 61\n2 Lightning Bolt (FDC) 163' })
    await page.goto(`/decks/${deck.id}`)
    await deckMenu(page, 'Export missing')
    await expect(option(page, 'Include cards in other decks')).toBeChecked()
    await expect(text(page)).toHaveValue('1 Counterspell (FDC) 61\n2 Lightning Bolt (FDC) 163\n')
    await option(page, 'Include cards in other decks').click()
    await expect(text(page)).toHaveValue('2 Lightning Bolt (FDC) 163\n')
    await option(page, 'Printings').click()
    await expect(text(page)).toHaveValue('2 Lightning Bolt\n')
  })
})

test.describe('Steady layout', () => {
  test('AC-1: opening a select or menu keeps the scrollbar and the layout', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const names = ['Lightning Bolt', 'Counterspell', 'Shivan Dragon', 'Sol Ring', 'Forest', 'Brainstorm', 'Island', 'Mountain']
    const deck = await api.deck('Steady', 'casual', { text: 'Deck\n' + names.map((n) => `1 ${n}`).join('\n') })
    await page.setViewportSize({ width: 1280, height: 400 })
    await page.goto(`/decks/${deck.id}`)
    await page.getByTestId('deck-row').first().waitFor()
    const layout = () => page.evaluate(() => ({
      x: [...document.querySelectorAll('h1,h2')].find((h) => h.textContent?.trim() === 'Steady')!.getBoundingClientRect().x,
      scrollbar: window.innerWidth - document.documentElement.clientWidth,
    }))
    const before = await layout()
    expect(before.scrollbar).toBeGreaterThan(0)

    await page.getByRole('combobox').nth(1).click()
    await expect(page.getByRole('listbox')).toBeVisible()
    expect(await layout()).toEqual(before)
    await page.mouse.move(640, 380)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    expect(await layout()).toEqual(before)
  })
})
