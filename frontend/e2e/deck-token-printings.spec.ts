import { expect, test, type Page } from '@playwright/test'
import { cardDialog, createUser, deckRow, logOut, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 021: token rows, the Token dialog, token printings and prices (AC-8 to AC-11).
// Fixture: Dockside Extortionist (2X2) makes a Treasure: T2X2 #22 (€0.29), also printed as TCMM #48 (no price).
const LIST = 'Deck\n1 Dockside Extortionist (2X2) 107\n1 Lightning Bolt (FDC) 163'
const tokens = (page: Page) => page.getByTestId('deck-tokens')
const dialog = (page: Page) => page.getByTestId('token-dialog')

test.describe('Deck token printings', () => {
  test('AC-8, AC-9: rows in Text and List, tiles in Images; hover shows the image only; click opens the Token dialog', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Treasure', 'casual', { text: LIST })
    for (const layout of ['text', 'list']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      const row = tokens(page).getByTestId('token-row')
      await expect(row).toHaveText('Treasure') // spec 023, AC-3: the name only
      await expect(tokens(page).locator('img')).toHaveCount(0)
    }
    const row = tokens(page).getByRole('button', { name: 'Treasure' })
    await row.hover()
    await expect(page.getByTestId('card-preview')).toBeVisible()
    await expect(page.getByTestId('preview-caption')).toHaveCount(0)

    await page.goto(`/decks/${deck.id}?layout=visual`)
    const tile = tokens(page).getByRole('button', { name: 'Treasure' })
    await expect(tile.locator('img')).toBeVisible()
    await tile.hover()
    await expect(page.getByTestId('preview-caption')).toHaveCount(0)
    await tile.click()
    await expect(dialog(page).getByRole('heading', { name: 'Treasure' })).toBeVisible()
    await expect(dialog(page).getByTestId('token-makers')).toHaveText(/Made by\s*Dockside Extortionist/)
    // AC-11: the price under the image, in the user's currency (EUR).
    await expect(dialog(page).getByTestId('token-price')).toHaveText('€0.29')
    await dialog(page).getByRole('button', { name: 'Preview Treasure', exact: true }).click()
    await expect(page.getByTestId('fullscreen')).toHaveAttribute('aria-label', 'Treasure')
  })

  test('AC-10, AC-11: the owner picks a printing for the deck; Default goes back; visitors see it without a picker; nothing counts', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Treasure art', 'casual', { is_public: true, text: LIST })
    const before = await api.get(`/api/decks/${deck.id}/`)
    expect(before.tokens[0]).toMatchObject({ set_code: 't2x2', chosen: false, price: 0.29 })

    await page.goto(`/decks/${deck.id}`)
    await tokens(page).getByRole('button', { name: 'Treasure' }).click()
    const picker = dialog(page).getByTestId('printing-picker')
    await expect(picker.getByRole('radio')).toHaveCount(2)
    await expect(picker.getByRole('radio', { checked: true })).toHaveAccessibleName(/#22/)
    await picker.getByRole('radio', { name: /#48/ }).click()
    await dialog(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Printing saved.')).toBeVisible()
    await expect(dialog(page).getByRole('dialog').or(dialog(page))).toContainText('#48')
    await expect(dialog(page).getByTestId('token-price')).toHaveText('–')

    const after = await api.get(`/api/decks/${deck.id}/`)
    expect(after.tokens[0]).toMatchObject({ set_code: 'tcmm', collector_number: '48', chosen: true })
    expect(after.value).toEqual(before.value) // tokens count toward nothing
    expect(after.counts.size).toBe(2)
    // Export doesn't follow the choice.
    expect((await api.get(`/api/decks/${deck.id}/export/?tokens=true&printings=true`)).text).toContain('Treasure (T2X2) 22')

    // Visitors see the chosen art, no picker.
    await page.keyboard.press('Escape')
    await logOut(page)
    await createUser(request, uniqueUser('v'))
    await page.goto(`/u/${user.username}/decks/${deck.id}?layout=visual`)
    await expect(tokens(page).getByRole('img', { name: 'Treasure' })).toHaveAttribute('src', /./)
    await tokens(page).getByRole('button', { name: 'Treasure' }).click()
    await expect(dialog(page)).toContainText('#48')
    await expect(dialog(page).getByTestId('token-printings')).toHaveCount(0)

    // Default goes back to the first maker's art.
    const owner = await api.post(`/api/decks/${deck.id}/token-printing/`, { kind: after.tokens[0].kind, token: null })
    expect(owner.tokens[0]).toMatchObject({ set_code: 't2x2', chosen: false })
  })

  test('AC-10: Default in the dialog; the card dialog keeps its token images', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Default', 'casual', { text: LIST })
    const kind = (await api.get(`/api/decks/${deck.id}/`)).tokens[0].kind
    const tcmm = (await api.get(`/api/decks/${deck.id}/`)).tokens[0].id
    const printings = await api.get(`/api/catalog/tokens/${tcmm}/printings/`)
    await api.post(`/api/decks/${deck.id}/token-printing/`, { kind, token: printings.find((p: { set_code: string }) => p.set_code === 'tcmm').id })
    await page.goto(`/decks/${deck.id}`)
    await tokens(page).getByRole('button', { name: 'Treasure' }).click()
    await dialog(page).getByRole('button', { name: 'Default' }).click()
    await expect(page.getByText('Back to the default printing.')).toBeVisible()
    await expect(dialog(page)).toContainText('#22')
    await expect(dialog(page).getByRole('button', { name: 'Default' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await deckRow(page, 'Dockside Extortionist').click()
    await expect(cardDialog(page).getByTestId('card-tokens').getByRole('button', { name: 'Treasure' }).locator('img')).toBeVisible()
  })
})
