import { expect, test, type Page } from '@playwright/test'
import { apiAs, createUser, locationTile, signUpAndLogIn, tile, uniqueUser } from './helpers'

// Spec 002 AC-24 to AC-38 (replaces spec 001 AC-26 to AC-28). EDHREC data comes
// from backend/cards/fixtures/edhrec/sol-ring.json; other cards have none.
const detail = (page: Page) => page.getByTestId('card-detail')

/** Close the detail once the confirmation has finished closing (it would eat the Escape). */
async function closeDetail(page: Page) {
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(detail(page)).toHaveCount(0)
}

test.describe('Card detail', () => {
  test('AC-24, AC-25: big image and your copies with prices', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Red Binder')
    await api.importList('2 Sol Ring (C21) 263', binder, { condition: 'LP', purchase_price: 1.5, purchase_currency: 'EUR' })
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await expect(detail(page).getByRole('heading', { name: 'Sol Ring' })).toBeVisible()
    await expect(detail(page)).toContainText('Commander 2021 #263')
    await expect(page.getByTestId('detail-image')).toBeVisible()
    expect((await page.getByTestId('detail-image').boundingBox())!.width).toBeGreaterThan(250)
    await expect(page.getByTestId('detail-quantity')).toHaveText('2')
    await expect(page.getByTestId('detail-condition')).toHaveText('Lightly Played')
    await expect(page.getByTestId('detail-location')).toHaveText('Red Binder')
    await expect(page.getByTestId('detail-price')).toHaveText('€0.91')
    await expect(page.getByTestId('detail-added-price')).toHaveText('€0.91')
    await expect(page.getByTestId('detail-purchase-price')).toHaveText('€1.50')
    await expect(detail(page).getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(detail(page).getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('AC-26, AC-27: reprints strip; switching asks first, then switches or merges', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Lightning Bolt (MSC) 806\n2 Lightning Bolt (FDC) 163\n1 Counterspell (FDC) 61')
    await page.goto('/cards?sort=set')
    await tile(page, 'Counterspell').click()
    const reprints = page.getByTestId('reprints').getByRole('radio')
    await expect(reprints).toHaveCount(4)
    await expect(page.getByTestId('reprints').getByRole('radio', { checked: true })).toHaveAccessibleName('Foundations Commander #61')

    // Cancel keeps the printing
    await page.getByTestId('reprints').getByRole('radio', { name: /#7123$/ }).click()
    await expect(page.getByTestId('confirm-dialog')).toContainText('Your 1 copy change to this printing.')
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(detail(page)).toContainText('#61')

    // Switch without a merge
    await page.getByTestId('reprints').getByRole('radio', { name: /#7123$/ }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Switch' }).click()
    await expect(page.getByText('Switched printing.')).toBeVisible()
    await expect(detail(page).getByText('#7123', { exact: false }).first()).toBeVisible()
    await closeDetail(page)

    // Switch into an existing row: merge
    await tile(page, 'Lightning Bolt').last().click() // MSC sorts after FDC
    await page.getByTestId('reprints').getByRole('radio', { name: / #163$/ }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Switch' }).click()
    await expect(page.getByText('Switched. It matched another row, so the two merged.')).toBeVisible()
    await closeDetail(page)
    await expect(tile(page, 'Lightning Bolt')).toHaveCount(1)
    await expect(tile(page, 'Lightning Bolt').getByTestId('card-quantity')).toHaveText('×3')
  })

  test('AC-28 to AC-31: EDHREC tabs: commanders with deck share, played-with groups, similar', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await expect(detail(page).getByRole('tab')).toHaveText(['Commanders', 'Played with', 'Similar'])
    const commanders = page.getByTestId('edhrec-commanders')
    await expect(commanders.getByTestId('edhrec-card').first()).toContainText("Y'shtola, Night's Blessed")
    await expect(commanders.getByTestId('edhrec-card').first()).toContainText('94% of decks')

    await detail(page).getByRole('tab', { name: 'Played with' }).click()
    const played = page.getByTestId('edhrec-played-with')
    await expect(played.getByRole('heading')).toContainText(['Creatures', 'Instants', 'Sorceries'])
    await expect(played.getByRole('heading', { name: 'Top Commanders' })).toHaveCount(0)

    await detail(page).getByRole('tab', { name: 'Similar' }).click()
    await expect(page.getByTestId('edhrec-similar')).toContainText('Mana Vault')
  })

  test('AC-32 to AC-34: preview on hover; clicking a card opens it with a back arrow', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await detail(page).getByRole('tab', { name: 'Played with' }).click()
    const rhystic = page.getByTestId('edhrec-played-with').getByRole('button', { name: 'Rhystic Study', exact: true })
    await rhystic.hover()
    await expect(page.getByTestId('card-preview')).toBeVisible()
    await rhystic.click()

    await expect(detail(page).getByRole('heading', { name: 'Rhystic Study' })).toBeVisible()
    await expect(page.getByTestId('owned')).toHaveText('You own 0')
    await expect(detail(page).getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
    await expect(detail(page).getByRole('button', { name: 'Add to want list' })).toBeDisabled()
    await detail(page).getByRole('button', { name: 'Back' }).click()
    await expect(detail(page).getByRole('heading', { name: 'Sol Ring' })).toBeVisible()
    await expect(page.getByTestId('detail-quantity')).toHaveText('1')
  })

  test('AC-36: a card without EDHREC data says so; the rest works', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Delver of Secrets (ISD) 51')
    await page.goto('/cards')
    await tile(page, 'Delver of Secrets // Insectile Aberration').click()
    await expect(page.getByTestId('edhrec-empty')).toHaveText('No EDHREC data')
    await expect(page.getByTestId('detail-quantity')).toHaveText('1')
  })

  test('AC-38: Edit and Delete from the detail', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('2 Sol Ring (C21) 263')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click()
    await detail(page).getByRole('button', { name: 'Edit' }).click()
    await page.getByTestId('edit-dialog').getByLabel('Quantity').fill('5')
    await page.getByTestId('edit-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('detail-quantity')).toHaveText('5')

    await detail(page).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('confirm-dialog')).toContainText('This removes 5 cards from your collection.')
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Deleted Sol Ring.')).toBeVisible()
    await expect(detail(page)).toHaveCount(0)
    await expect(tile(page, 'Sol Ring')).toHaveCount(0)
  })
})

test('AC-37: on a public location the detail is read-only, with EDHREC tabs', async ({ page, request }) => {
  const owner = uniqueUser('pubd')
  await createUser(request, owner)
  const api = await apiAs(request, owner)
  const showcase = await api.location('Showcase', 'binder', true)
  await api.importList('1 Sol Ring (C21) 263', showcase, { purchase_price: 50, purchase_currency: 'EUR' })
  await page.goto(`/u/${owner.username}`)
  await locationTile(page, 'Showcase').getByRole('link').click()
  await page.getByLabel('Grid view').click() // binders open in binder view (spec 007)
  await tile(page, 'Sol Ring').click()
  await expect(page.getByTestId('edhrec-commanders')).toContainText('94% of decks')
  await expect(detail(page)).not.toContainText('Purchase price')
  await expect(detail(page)).not.toContainText('Price when added')
  await expect(detail(page).getByRole('button', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByTestId('reprints').locator('button[role=radio]')).toHaveCount(0)
})
