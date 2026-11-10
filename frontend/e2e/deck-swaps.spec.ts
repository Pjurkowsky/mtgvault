import { expect, test, type Page } from '@playwright/test'
import { createUser, deckRow, logOut, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 005: swap candidates (AC-9 to AC-13), with spec 021's dialog, one-copy swaps and Unpair.
async function propose(page: Page, card: string, query: string, candidate: string) {
  await deckRow(page, card).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Propose swap' }).click()
  const dialog = page.getByTestId('swap-dialog')
  await expect(dialog.getByTestId('swap-out-picked')).toContainText(card)
  await dialog.getByLabel('Card name').fill(query)
  await dialog.getByRole('button', { name: candidate, exact: true }).click()
  await dialog.getByRole('button', { name: 'Propose' }).click()
  await expect(page.getByText(`${candidate} could replace ${card}.`)).toBeVisible()
  await expect(dialog).toBeHidden()
}

test.describe('Deck swaps', () => {
  test('AC-9 to AC-11: propose candidates, compare them, apply and undo, remove', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Swaps', 'casual', { text: 'Deck\n4 Lightning Bolt\n1 Forest\n\nMaybeboard\n1 Counterspell' })
    await page.goto(`/decks/${deck.id}`)
    await propose(page, 'Lightning Bolt', 'Shivan', 'Shivan Dragon')
    await propose(page, 'Lightning Bolt', 'Brainstorm', 'Brainstorm')
    await expect(page.getByTestId('group-maybe')).toContainText('Maybeboard (3)') // Counterspell needs no link

    await page.getByRole('tab', { name: 'Swaps' }).click()
    const bolt = page.getByTestId('swap-Lightning Bolt')
    await expect(bolt.getByTestId('swap-candidate')).toHaveCount(2)
    const shivan = bolt.getByTestId('swap-candidate').filter({ hasText: 'Shivan Dragon' })
    // Spec 006, AC-10: both cards side by side, labelled differences under the swap button.
    await expect(shivan.getByTestId('swap-out')).toContainText('Lightning Bolt')
    await expect(shivan.getByTestId('swap-out')).toContainText('Mana value 1')
    await expect(shivan.getByTestId('swap-in')).toContainText('Mana value 6')
    await expect(shivan.getByTestId('swap-mv')).toHaveText('Mana value +5')
    await expect(shivan.getByTestId('swap-price')).toContainText(/^Price /)
    await expect(shivan.getByTestId('swap-in').getByTestId('ownership')).toHaveAttribute('data-state', 'missing')

    // AC-11: a card's proposals collapse under its heading, remembered.
    await bolt.getByRole('button', { name: /Lightning Bolt · 2 proposals/ }).click()
    await expect(bolt.getByTestId('swap-candidate')).toHaveCount(0)
    await page.reload()
    await expect(bolt.getByTestId('swap-candidate')).toHaveCount(0)
    await bolt.getByRole('button', { name: /Lightning Bolt · 2 proposals/ }).click()
    await expect(bolt.getByTestId('swap-candidate')).toHaveCount(2)

    // Apply (spec 021, AC-17): one Shivan replaces one of the 4 Bolts; that Bolt waits in the Maybeboard as its candidate.
    await shivan.getByRole('button', { name: 'Swap', exact: true }).click()
    await expect(page.getByText('Swapped in Shivan Dragon.')).toBeVisible()
    const back = page.getByTestId('swap-Shivan Dragon')
    await expect(back.getByTestId('swap-in')).toHaveText([/Lightning Bolt/])
    let cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { zone: string; quantity: number; printing: { name: string } }[]
    const find = (name: string, zone: string) => cards.find((c) => c.printing.name === name && c.zone === zone)
    expect(find('Shivan Dragon', 'main')).toMatchObject({ quantity: 1 })
    expect(find('Lightning Bolt', 'main')).toMatchObject({ quantity: 3 })
    expect(find('Lightning Bolt', 'maybe')).toMatchObject({ quantity: 1 })

    // Undo by applying the old card back: 4 Bolts again, Shivan back to the Bolts' proposals.
    await back.getByTestId('swap-candidate').filter({ hasText: 'Lightning Bolt' }).getByRole('button', { name: 'Swap', exact: true }).click()
    await expect(page.getByText('Swapped in Lightning Bolt.')).toBeVisible()
    await expect(page.getByTestId('swap-Lightning Bolt').getByTestId('swap-candidate')).toHaveCount(2)
    cards = (await api.get(`/api/decks/${deck.id}/`)).cards
    expect(find('Lightning Bolt', 'main')).toMatchObject({ quantity: 4 })

    // Unpair (spec 021, AC-16): Brainstorm stays in the Maybeboard.
    await page.getByTestId('swap-Lightning Bolt').getByTestId('swap-candidate').filter({ hasText: 'Brainstorm' }).getByRole('button', { name: 'Unpair' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Unpair' }).click()
    await expect(page.getByTestId('swap-candidate')).toHaveCount(1)
    await expect(page.getByTestId('unpaired-card').filter({ hasText: 'Brainstorm' })).toBeVisible()
    cards = (await api.get(`/api/decks/${deck.id}/`)).cards
    expect(find('Brainstorm', 'maybe')).toBeTruthy()
  })

  test('AC-12, AC-13: removing a card unlinks its candidates; public decks show Swaps read-only', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Public swaps', 'casual', { is_public: true, text: '1 Lightning Bolt\n1 Counterspell' })
    await page.goto(`/decks/${deck.id}`)
    await propose(page, 'Lightning Bolt', 'Shivan', 'Shivan Dragon')
    await propose(page, 'Counterspell', 'Brainstorm', 'Brainstorm')

    await logOut(page)
    await createUser(request, uniqueUser('v'))
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await page.getByRole('tab', { name: 'Swaps' }).click()
    await expect(page.getByTestId('swap-candidate')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Swap', exact: true })).toHaveCount(0)

    // Removing Lightning Bolt keeps Shivan in the Maybeboard, unpaired; a candidate leaving the
    // Maybeboard keeps its pair, blocked (spec 021, AC-18).
    const detail = await api.get(`/api/decks/${deck.id}/`)
    const id = (name: string) => detail.cards.find((c: { printing: { name: string } }) => c.printing.name === name).id
    await api.delete(`/api/decks/${deck.id}/cards/${id('Lightning Bolt')}/`)
    await api.patch(`/api/decks/${deck.id}/cards/${id('Brainstorm')}/`, { zone: 'main' })
    await page.reload()
    await expect(page.getByTestId('unpaired-card')).toContainText('Shivan Dragon')
    await expect(page.getByTestId('swap-Counterspell').getByTestId('swap-candidate')).toHaveAttribute('data-blocked', 'true')
    const after = (await api.get(`/api/decks/${deck.id}/`)).cards as { zone: string; swap_for: number[]; printing: { name: string } }[]
    expect(after.find((c) => c.printing.name === 'Shivan Dragon')).toMatchObject({ zone: 'maybe', swap_for: [] })
    expect(after.find((c) => c.printing.name === 'Brainstorm')).toMatchObject({ zone: 'main', swap_for: [id('Counterspell')] })
  })
})
