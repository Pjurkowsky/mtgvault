import { expect, test, type Page } from '@playwright/test'
import { createUser, deckRow, logOut, signUpAndLogIn, uniqueUser } from './helpers'

// Spec 021: every Maybeboard card on Swaps, several pairs, the Propose swap dialog, Unpair,
// one-copy swaps and blocked pairs (AC-12 to AC-19).
const LIST = 'Deck\n1 Lightning Bolt\n1 Counterspell\n30 Forest\n\nMaybeboard\n1 Shivan Dragon\n1 Brainstorm'
const dialog = (page: Page) => page.getByTestId('swap-dialog')
const group = (page: Page, name: string) => page.getByTestId(`swap-${name}`)
const pair = (page: Page, out: string, into: string) => group(page, out).getByTestId('swap-candidate').filter({ hasText: into })

async function pickOut(page: Page, name: string) {
  await dialog(page).getByLabel('Deck card').fill(name.slice(0, 5))
  await dialog(page).getByTestId('swap-out-options').getByRole('button', { name }).click()
}

test.describe('Deck pairs', () => {
  test('AC-12 to AC-15: unpaired first, the Propose swap dialog from every entry point, several pairs', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Pairs', 'casual', { text: LIST })
    await page.goto(`/decks/${deck.id}?tab=swaps`)

    // AC-12: Unpaired first, sorted, foldable and remembered.
    const unpaired = page.getByTestId('swap-unpaired')
    await expect(unpaired.getByTestId('unpaired-card')).toHaveText([/Brainstorm/, /Shivan Dragon/])
    await unpaired.getByRole('button', { name: /Unpaired · 2 cards/ }).click()
    await expect(unpaired.getByTestId('unpaired-card')).toHaveCount(0)
    await page.reload()
    await expect(unpaired.getByTestId('unpaired-card')).toHaveCount(0)
    await unpaired.getByRole('button', { name: /Unpaired/ }).click()

    // AC-14: the Swaps tab button; In lists the Maybeboard first.
    await page.getByRole('button', { name: 'Propose swap' }).click()
    await pickOut(page, 'Lightning Bolt')
    await expect(dialog(page).getByTestId('swap-maybe-options').getByRole('button')).toHaveText([/Brainstorm/, /Shivan Dragon/])
    await dialog(page).getByTestId('swap-maybe-options').getByRole('button', { name: 'Shivan Dragon' }).click()
    await dialog(page).getByRole('button', { name: 'Propose' }).click()
    await expect(page.getByText('Shivan Dragon could replace Lightning Bolt.')).toBeVisible()
    await expect(pair(page, 'Lightning Bolt', 'Shivan Dragon')).toBeVisible()
    await expect(unpaired.getByTestId('unpaired-card')).toHaveText([/Brainstorm/])
    // Unpaired sits above the pairs.
    expect((await unpaired.boundingBox())!.y).toBeLessThan((await group(page, 'Lightning Bolt').boundingBox())!.y)

    // AC-15: Pair with… fills In.
    await unpaired.getByRole('button', { name: 'Pair with…' }).click()
    await expect(dialog(page).getByTestId('swap-in-picked')).toContainText('Brainstorm')
    await pickOut(page, 'Counterspell')
    await dialog(page).getByRole('button', { name: 'Propose' }).click()
    await expect(pair(page, 'Counterspell', 'Brainstorm')).toBeVisible()
    await expect(unpaired).toHaveCount(0)

    // AC-13, AC-15: a deck card's menu fills Out; Shivan pairs with a second card.
    await page.getByRole('tab', { name: 'Deck' }).click()
    await deckRow(page, 'Counterspell').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Propose swap' }).click()
    await expect(dialog(page).getByTestId('swap-out-picked')).toContainText('Counterspell')
    await dialog(page).getByTestId('swap-maybe-options').getByRole('button', { name: 'Shivan Dragon' }).click()
    await dialog(page).getByRole('button', { name: 'Propose' }).click()
    await expect(page.getByText('Shivan Dragon could replace Counterspell.')).toBeVisible()

    // A Maybeboard card's menu fills In; an existing pair changes nothing.
    await deckRow(page, 'Shivan Dragon').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Propose swap' }).click()
    await expect(dialog(page).getByTestId('swap-in-picked')).toContainText('Shivan Dragon')
    await pickOut(page, 'Lightning Bolt')
    await dialog(page).getByRole('button', { name: 'Propose' }).click()
    await expect(page.getByText('Already proposed.')).toBeVisible()
    await page.keyboard.press('Escape')

    // A typed card joins the Maybeboard.
    await page.getByRole('tab', { name: 'Swaps' }).click()
    await page.getByRole('button', { name: 'Propose swap' }).click()
    await pickOut(page, 'Forest')
    await dialog(page).getByLabel('Card name').fill('Sol Ring')
    await dialog(page).getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Propose' }).click()
    await expect(pair(page, 'Forest', 'Sol Ring')).toBeVisible()

    await expect(pair(page, 'Lightning Bolt', 'Shivan Dragon')).toBeVisible()
    await expect(pair(page, 'Counterspell', 'Shivan Dragon')).toBeVisible()
    const shivan = (await api.get(`/api/decks/${deck.id}/`)).cards.find((c: { printing: { name: string } }) => c.printing.name === 'Shivan Dragon')
    expect(shivan.swap_for).toHaveLength(2)
  })

  test('AC-16 to AC-18: Unpair keeps the card; a swap replaces one copy; pairs of a card in the deck wait', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Apply', 'casual', { text: LIST })
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; zone: string; printing: { id: string; name: string } }[]
    const id = (name: string) => cards.find((c) => c.printing.name === name)!.id
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Shivan Dragon') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Counterspell'), card: id('Shivan Dragon') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Forest'), card: id('Brainstorm') })
    await page.goto(`/decks/${deck.id}?tab=swaps`)

    // AC-16: Unpair sits apart, behind a border, asks, and keeps the card.
    const actions = pair(page, 'Forest', 'Brainstorm').getByTestId('swap-actions')
    expect(await actions.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe('1px')
    await actions.getByRole('button', { name: 'Unpair' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Brainstorm stays in the Maybeboard')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Unpair' }).click()
    await expect(page.getByTestId('unpaired-card')).toHaveText([/Brainstorm/])
    await expect(group(page, 'Forest')).toHaveCount(0)

    // AC-17: one Brainstorm for one of 30 Forests.
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Forest'), card: id('Brainstorm') })
    await page.reload()
    await pair(page, 'Forest', 'Brainstorm').getByRole('button', { name: 'Swap', exact: true }).click()
    await expect(page.getByText('Swapped in Brainstorm.')).toBeVisible()
    let now = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; zone: string; quantity: number; swap_for: number[]; printing: { name: string } }[]
    const at = (name: string, zone: string) => now.find((c) => c.printing.name === name && c.zone === zone)
    expect(at('Forest', 'main')).toMatchObject({ quantity: 29 })
    expect(at('Brainstorm', 'main')).toMatchObject({ quantity: 1 })
    expect(at('Forest', 'maybe')).toMatchObject({ quantity: 1, swap_for: [at('Brainstorm', 'main')!.id] })
    await expect(pair(page, 'Brainstorm', 'Forest')).toBeVisible()

    // AC-17, AC-18: Shivan for Bolt; its pair with Counterspell waits, amber, In deck.
    await pair(page, 'Lightning Bolt', 'Shivan Dragon').getByRole('button', { name: 'Swap', exact: true }).click()
    await expect(page.getByText('Swapped in Shivan Dragon.')).toBeVisible()
    const waiting = pair(page, 'Counterspell', 'Shivan Dragon')
    await expect(waiting).toHaveAttribute('data-blocked', 'true')
    await expect(waiting.getByRole('button', { name: 'Swap', exact: true })).toBeDisabled()
    await waiting.getByTestId('in-deck').hover()
    await expect(page.getByRole('tooltip')).toContainText('Shivan Dragon is already in the deck')
    expect(await waiting.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    await expect(waiting.getByRole('button', { name: 'Unpair' })).toBeEnabled()
    now = (await api.get(`/api/decks/${deck.id}/`)).cards
    expect(at('Lightning Bolt', 'maybe')!.swap_for).toEqual([at('Shivan Dragon', 'main')!.id])

    // Undo: Shivan back in the Maybeboard, the Counterspell pair works again.
    await pair(page, 'Shivan Dragon', 'Lightning Bolt').getByRole('button', { name: 'Swap', exact: true }).click()
    await expect(page.getByText('Swapped in Lightning Bolt.')).toBeVisible()
    await expect(waiting).not.toHaveAttribute('data-blocked', 'true')
    await expect(waiting.getByRole('button', { name: 'Swap', exact: true })).toBeEnabled()
  })

  test('AC-19: a public deck\'s Swaps tab is read only', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Public pairs', 'casual', { is_public: true, text: LIST })
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; printing: { name: string } }[]
    const id = (name: string) => cards.find((c) => c.printing.name === name)!.id
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Shivan Dragon') })

    await logOut(page)
    await createUser(request, uniqueUser('v'))
    await page.goto(`/u/${user.username}/decks/${deck.id}?tab=swaps`)
    await expect(page.getByTestId('unpaired-card')).toHaveText([/Brainstorm/])
    await expect(page.getByTestId('swap-candidate')).toHaveCount(1)
    for (const name of ['Propose swap', 'Pair with…', 'Swap', 'Unpair']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }
  })
})
