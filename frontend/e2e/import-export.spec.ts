import { expect, test, type Page } from '@playwright/test'
import { apiAs, check, choose, createUser, locationTile, more, signUpAndLogIn, tile, uniqueUser } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const LIST = `# deck
4 Lightning Bolt (MSC) 806
1x Sol Ring
2 Fire // Ice (MH2) 290 *E*
1 Delver of Secrets *F*
1 Brainstorm (XXX)
1 No Such Card
// sideboard
1 Lightning Helix (PWCS) 2024-07 *F*`

async function openImport(page: Page) {
  await more(page, 'Import')
  return page.getByRole('dialog')
}

test.describe('Import', () => {
  test('AC-45 to AC-49: paste, choose defaults, preview with errors, then confirm', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.location('Deck Box', 'deck_box')
    await page.goto('/cards')
    const dialog = await openImport(page)
    await dialog.getByLabel('Card list').fill(LIST)
    await choose(page, 'Location', 'Deck Box')
    await choose(page, 'Condition', 'Lightly Played')
    await choose(page, 'Language', 'German')
    await dialog.getByLabel('Purchase price per copy').fill('0.50')
    await dialog.getByRole('button', { name: 'Preview' }).click()

    const rows = page.getByTestId('import-rows').getByRole('listitem')
    await expect(rows).toHaveCount(5)
    await expect(rows.nth(0)).toContainText('4×Lightning Bolt')
    await expect(rows.nth(2)).toContainText('etched')
    await expect(rows.nth(3)).toContainText('foil')
    const errors = page.getByTestId('import-errors')
    await expect(errors).toContainText('Line 6:')
    await expect(errors).toContainText('No printing of "Brainstorm" in XXX.')
    await expect(errors).toContainText('Line 7:')
    await expect(errors).toContainText('No card named "No Such Card".')

    // AC-48: nothing saved yet
    expect((await api.get('/api/items/')).count).toBe(0)

    await dialog.getByRole('button', { name: 'Import 9 cards' }).click()
    await expect(page.getByText('Imported 9 cards.')).toBeVisible()
    await expect(page.getByTestId('browser-summary')).toContainText('9 cards')

    await tile(page, 'Sol Ring').click()
    await expect(page.getByTestId('detail-condition')).toHaveText('Lightly Played')
    await expect(page.getByTestId('copies')).toContainText('German')
    await expect(page.getByTestId('detail-location')).toHaveText('Deck Box')
    await expect(page.getByTestId('detail-purchase-price')).toHaveText('€0.50')
  })

  test('AC-45: upload a .txt file; imports merge with existing rows', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    const dialog = await openImport(page)
    await dialog.getByLabel('Upload .txt file').setInputFiles({
      name: 'list.txt', mimeType: 'text/plain', buffer: Buffer.from('2 Sol Ring (C21) 263\n'),
    })
    await expect(dialog.getByLabel('Card list')).toHaveValue('2 Sol Ring (C21) 263\n')
    await dialog.getByRole('button', { name: 'Preview' }).click()
    await dialog.getByRole('button', { name: 'Import 2 cards' }).click()
    await expect(tile(page, 'Sol Ring').getByTestId('card-quantity')).toHaveText('×3')
  })
})

test.describe('Export', () => {
  test('AC-51, AC-52: export the current view as text; copy and download', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('4 Lightning Bolt (MSC) 806\n1 Sol Ring (C21) 263\n2 Fire // Ice (MH2) 290 *E*')
    await page.goto('/cards?q=i')
    await more(page, 'Export')
    const text = page.getByTestId('export-text')
    await expect(text).toHaveValue('2 Fire // Ice (MH2) 290 *E*\n4 Lightning Bolt (MSC) 806\n1 Sol Ring (C21) 263\n')

    await page.goto('/cards?q=bolt')
    await more(page, 'Export')
    await expect(text).toHaveValue('4 Lightning Bolt (MSC) 806\n')
    await page.getByRole('button', { name: 'Copy' }).click()
    await expect(page.getByText('Copied.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('4 Lightning Bolt (MSC) 806\n')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download .txt' }).click()
    expect((await download).suggestedFilename()).toBe('collection.txt')
  })

  test('AC-51: bulk Export exports only the selection', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('4 Lightning Bolt (MSC) 806\n1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await check(page, 'Sol Ring')
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Export' }).click()
    await expect(page.getByTestId('export-text')).toHaveValue('1 Sol Ring (C21) 263\n')
  })

  test('AC-53: export then import reproduces printings, finishes and quantities', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const list = '1 Delver of Secrets // Insectile Aberration (ISD) 51 *F*\n2 Fire // Ice (MH2) 290 *E*\n1 Lightning Helix (PWCS) 2024-07 *F*\n4 Sol Ring (C21) 263\n'
    await api.importList(list)
    const exported = (await api.post('/api/items/export/', { selection: { filter: {} } })).text
    expect(exported).toBe(list)

    const other = uniqueUser('copy')
    await createUser(request, other)
    const otherApi = await apiAs(request, other)
    await otherApi.importList(exported)
    expect((await otherApi.post('/api/items/export/', { selection: { filter: {} } })).text).toBe(list)
  })
})

test('import into a location from its page defaults to that location', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await api.location('Shoebox', 'box')
  await page.reload()
  await locationTile(page, 'Shoebox').getByRole('link').click()
  await openImport(page)
  await expect(page.getByRole('combobox', { name: 'Location' })).toHaveText('Shoebox')
})
