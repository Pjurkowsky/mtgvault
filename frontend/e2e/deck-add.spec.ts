import { expect, test } from '@playwright/test'
import { cardDialog, closeCardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 005: the deck's Add card and card dialog are the collection's (AC-1 to AC-5).
test.describe('Deck add and card dialog', () => {
  test('AC-1, AC-2: search step, deck step, and copies for the collection starting in the deck box', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Boxed', 'modern', { create_box: true })
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Card name').fill('Counter')
    await expect(dialog.getByTestId('card-results')).toBeVisible()
    await dialog.getByRole('button', { name: 'Counterspell', exact: true }).click()

    const also = dialog.getByRole('checkbox', { name: 'Also add to my collection' })
    await expect(also).not.toBeChecked()
    await expect(dialog.getByLabel('Condition')).toHaveCount(0)
    await also.click()
    await expect(dialog.getByLabel('Condition')).toBeVisible()
    await expect(dialog.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Boxed' })).toHaveAttribute('data-state', 'on')
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Counterspell to Mainboard and your collection.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(deckRow(page, 'Counterspell').getByTestId('ownership')).toHaveAttribute('data-state', 'in_box')
    expect((await api.get(`/api/items/?location=${deck.location}`)).count).toBe(1)
  })

  test('AC-2: without a deck box a location must be picked', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Loose', 'modern')
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Card name').fill('Sol Ring')
    await dialog.getByRole('button', { name: 'Sol Ring', exact: true }).click()
    await dialog.getByRole('checkbox', { name: 'Also add to my collection' }).click()
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(dialog).toContainText('Choose a location.')
    expect((await api.get(`/api/decks/${deck.id}/`)).cards).toHaveLength(0)
    await dialog.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Unfiled' }).click()
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Sol Ring to Mainboard and your collection.')).toBeVisible()
    expect((await api.get('/api/items/?location=unfiled')).count).toBe(1)
  })

  test('AC-3, AC-4: the card dialog has the deck section, your copies with edit and delete, and Add a new copy', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Binder')
    await api.importList('2 Sol Ring (C21) 263', binder)
    const deck = await api.deck('Rings', 'casual', { create_box: true, text: '1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, 'Sol Ring').click()
    const dialog = cardDialog(page)
    await expect(dialog.getByTestId('detail-image')).toBeVisible()
    await expect(dialog.getByRole('tab', { name: 'Commanders' })).toBeVisible()
    await expect(dialog.getByTestId('deck-section')).toBeVisible()
    await expect(dialog.getByTestId('deck-copy')).toContainText('2 in Binder')

    // Edit a copy with the collection's edit dialog.
    await dialog.getByRole('button', { name: 'Edit 2 in Binder' }).click()
    await expect(page.getByTestId('edit-dialog')).toBeVisible()
    await page.getByTestId('edit-dialog').getByLabel('Quantity').fill('1')
    await page.getByTestId('edit-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByTestId('deck-copy')).toContainText('1 in Binder')

    // Add a new copy: the collection's add fields, starting on the deck box; no one-click copy.
    await dialog.getByRole('button', { name: 'Add a new copy to the deck box' }).click()
    const add = page.getByRole('dialog').last()
    await expect(add.getByLabel('Condition')).toBeVisible()
    await expect(add.getByRole('group', { name: 'Location' }).getByRole('button', { name: 'Rings' })).toHaveAttribute('data-state', 'on')
    await add.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Added 1 × Sol Ring.')).toBeVisible()
    await expect(dialog.getByTestId('deck-copy').filter({ hasText: 'in Rings' })).toContainText('1 in Rings')

    // Delete a copy after a confirm.
    await dialog.getByRole('button', { name: 'Delete 1 in Binder' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Deleted Sol Ring.')).toBeVisible()
    await expect(dialog.getByTestId('deck-copy')).toHaveCount(1)
    await closeCardDialog(page)
    await expect(deckRow(page, 'Sol Ring').getByTestId('ownership')).toHaveAttribute('data-state', 'in_box')
  })

  test('AC-5: the Commander zone is offered only for possible commanders', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Piper', 'commander')
    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('button', { name: 'Add card' }).click()
    const dialog = page.getByRole('dialog')
    const zones = dialog.getByRole('group', { name: 'Zone' }).getByRole('button')
    await dialog.getByLabel('Card name').fill('Shivan')
    await dialog.getByRole('button', { name: 'Shivan Dragon', exact: true }).click()
    await expect(zones).toHaveText(['Mainboard', 'Maybeboard'])
    await dialog.getByLabel('Card name').fill('Prismatic Piper')
    await dialog.getByRole('button', { name: 'The Prismatic Piper', exact: true }).click()
    await expect(zones).toHaveText(['Commander', 'Mainboard', 'Maybeboard'])
  })
})
