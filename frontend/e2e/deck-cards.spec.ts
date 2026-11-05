import { expect, test } from '@playwright/test'
import { cardDialog, check, choose, closeCardDialog, deckRow, signUpAndLogIn, tile } from './helpers'

test.describe('Deck cards', () => {
  test('AC-8, AC-10: add by search with quantity and zone; same zone raises the quantity', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tempo', 'modern')
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Card name').fill('Counter')
    await dialog.getByRole('button', { name: 'Counterspell', exact: true }).click()
    const zones = dialog.getByRole('group', { name: 'Zone' }).getByRole('button')
    await expect(zones).toHaveText(['Mainboard', 'Sideboard', 'Maybeboard'])
    await dialog.getByLabel('Quantity').fill('2')
    await dialog.getByRole('group', { name: 'Zone' }).getByRole('button', { name: 'Sideboard' }).click()
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 2 × Counterspell to Sideboard.')).toBeVisible()

    // The dialog stays open for the next card.
    await dialog.getByLabel('Card name').fill('Counter')
    await dialog.getByRole('button', { name: 'Counterspell', exact: true }).click()
    await dialog.getByRole('group', { name: 'Zone' }).getByRole('button', { name: 'Sideboard' }).click()
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Counterspell to Sideboard.')).toBeVisible()
    await page.keyboard.press('Escape')

    const side = page.getByTestId('group-side')
    await expect(side).toContainText('Sideboard (3)')
    await expect(side.getByTestId('deck-row')).toHaveCount(1)
    await expect(deckRow(page, 'Counterspell')).toContainText('3')
  })

  test('AC-8, spec 005 AC-5: Commander decks have no Sideboard; the Commander zone only for possible commanders', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Piper', 'commander', { text: '1 Sol Ring\n1 The Prismatic Piper' })
    await page.goto(`/decks/${deck.id}`)
    const zones = cardDialog(page).getByRole('group', { name: 'Zone' }).getByRole('button')
    await deckRow(page, 'Sol Ring').click()
    await expect(zones).toHaveText(['Mainboard', 'Maybeboard'])
    await closeCardDialog(page)
    await deckRow(page, 'The Prismatic Piper').click()
    await expect(zones).toHaveText(['Commander', 'Mainboard', 'Maybeboard'])
  })

  test('AC-9, AC-11, AC-20: change quantity, zone and printing, then remove', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Counterspell (SLD) 7117')
    const deck = await api.deck('Edit me', 'modern', { text: '1 Counterspell (FDC) 61\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    // Any printing counts as owned (AC-9).
    await expect(deckRow(page, 'Counterspell').getByTestId('ownership')).toHaveAttribute('data-state', 'owned')

    await deckRow(page, 'Counterspell').click()
    const dialog = cardDialog(page)
    await expect(dialog.getByTestId('deck-card-ownership')).toContainText('1 in Unfiled')
    await dialog.getByRole('radio', { name: 'Secret Lair Drop #7120' }).click()
    await expect(page.getByText('Shows Secret Lair Drop #7120.')).toBeVisible()
    await dialog.getByLabel('Quantity').fill('3')
    await dialog.getByRole('group', { name: 'Zone' }).getByRole('button', { name: 'Maybeboard' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('group-maybe')).toContainText('Maybeboard (3)')
    const row = deckRow(page, 'Counterspell')

    await row.click()
    await expect(dialog.getByRole('radio', { name: 'Secret Lair Drop #7120' })).toHaveAttribute('aria-checked', 'true')
    await dialog.getByRole('button', { name: 'Remove from deck' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Removed Counterspell.')).toBeVisible()
    await expect(deckRow(page, 'Counterspell')).toHaveCount(0)
  })

  test('AC-10: Add to deck from the collection menu and bulk bar adds one copy each to the Mainboard', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('3 Sol Ring (C21) 263\n1 Counterspell (FDC) 61\n1 Counterspell (SLD) 7117\n1 Forest (M21) 272')
    const deck = await api.deck('From collection')
    await page.goto('/cards')
    await tile(page, 'Sol Ring').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Add to deck' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox', { name: 'Deck' })).toContainText('From collection')
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('Added 1 card to From collection.')).toBeVisible()

    await check(page, 'Counterspell')
    await page.getByRole('checkbox', { name: 'Select Counterspell' }).nth(1).click()
    await check(page, 'Forest')
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Add to deck' }).click()
    await choose(page, 'Zone', 'Maybeboard')
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('Added 2 cards to From collection.')).toBeVisible()
    await expect(page.getByTestId('selection-bar')).toBeHidden()

    await page.goto(`/decks/${deck.id}`)
    await expect(deckRow(page, 'Sol Ring')).toContainText('1')
    await expect(page.getByTestId('group-maybe')).toContainText('Maybeboard (2)')
  })

  test('AC-18, AC-19: Commander first, grouping, sorting, list and card images', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Groups', 'commander', {
      text: 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Lightning Bolt\n1 Counterspell\n1 Shivan Dragon\n1 Sol Ring\n5 Forest',
    })
    await page.goto(`/decks/${deck.id}`)
    const groups = page.getByTestId('deck-text').locator('section')
    await expect(groups.first()).toHaveAttribute('data-testid', 'group-commander')
    await expect(page.getByTestId('group-main-Instants')).toContainText('Instants (2)')
    await expect(page.getByTestId('group-main-Lands')).toContainText('Lands (5)')
    const instants = page.getByTestId('group-main-Instants').getByTestId('deck-row')
    await expect(instants).toHaveText([/Counterspell/, /Lightning Bolt/])

    await choose(page, 'Sort by', 'Mana value')
    await expect(instants).toHaveText([/Lightning Bolt/, /Counterspell/])

    await choose(page, 'Group by', 'By mana value')
    await expect(page.getByTestId('group-main-1')).toContainText('Lightning Bolt')
    await expect(page.getByTestId('group-main-1')).toContainText('Sol Ring')
    await expect(page.getByTestId('group-main-6')).toContainText('Shivan Dragon')

    await choose(page, 'Group by', 'By color')
    await expect(page.getByTestId('group-main-Red')).toContainText('Lightning Bolt')
    await expect(page.getByTestId('group-main-Blue')).toContainText('Counterspell')
    await expect(page.getByTestId('group-main-Colorless')).toContainText('Sol Ring')

    await page.getByRole('button', { name: 'List', exact: true }).click()
    await expect(page.getByTestId('deck-list')).toBeVisible()
    await deckRow(page, 'Shivan Dragon').hover()
    await expect(page.getByTestId('deck-preview')).toHaveAttribute('src', /.+/)

    await page.getByRole('button', { name: 'Card images' }).click()
    await expect(page.getByTestId('deck-visual')).toBeVisible()
    await page.getByTestId('deck-visual').getByRole('button', { name: 'Shivan Dragon', exact: true }).click()
    await expect(cardDialog(page)).toContainText('Shivan Dragon')
    await closeCardDialog(page)
    await page.reload()
    await expect(page.getByTestId('deck-visual')).toBeVisible()
    await expect(page.getByTestId('deck-visual')).toContainText('Red (2)')
  })

  test('AC-21: header shows format, size against the target, value, legality and the deck box', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Header', 'commander', { create_box: true, text: 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('deck-format')).toHaveText('Commander')
    await expect(page.getByTestId('deck-size')).toHaveText('2 / 100 cards')
    await expect(page.getByTestId('deck-header')).toContainText('€')
    await expect(page.getByTestId('deck-legal')).toHaveText('1 issue')
    await page.getByTestId('deck-box').click()
    await expect(page).toHaveURL(new RegExp(`/locations/${deck.location}$`))
  })
})
