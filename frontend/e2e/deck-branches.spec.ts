import { expect, test } from '@playwright/test'
import { deckRow, signUpAndLogIn } from './helpers'
import { branchMenu, branchRow, confirmWith, nameBranch, panel, showVersions } from './version-helpers'

// Spec 027: branches of a deck (AC-1 to AC-6).
test.describe('Deck branches', () => {
  test('AC-1 to AC-3, AC-5: the panel lists branches; a new branch is its own list, in the URL', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Branches', 'casual', { text: 'Deck\n4 Lightning Bolt\n1 Forest' })
    await page.goto(`/decks/${deck.id}`)

    // AC-1: it starts closed; the tab opens it, remembered.
    await expect(panel(page)).toHaveAttribute('data-state', 'closed')
    await showVersions(page)
    await page.reload()
    await expect(panel(page)).toHaveAttribute('data-state', 'open')
    await expect(page.getByTestId('branch')).toHaveCount(1)
    await expect(branchRow(page, 'Main')).toHaveAttribute('data-current', 'true')

    // AC-3: from the shown branch's list; the panel says where it came from.
    await page.getByTestId('new-branch').click()
    await nameBranch(page, 'Aggro')
    await expect(page.getByText('Branch Aggro created.')).toBeVisible()
    await expect(page).toHaveURL(/[?&]branch=\d+/)
    await expect(branchRow(page, 'Aggro')).toHaveAttribute('data-current', 'true')
    await expect(branchRow(page, 'Aggro').getByTestId('branch-from')).toHaveText('from Main')
    await expect(page.getByTestId('deck-branch')).toHaveText('Aggro')
    await expect(page.getByTestId('deck-size')).toHaveText('5 cards')

    // AC-5: edits work on the shown branch only.
    await deckRow(page, 'Forest').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await confirmWith(page, 'Remove')
    await expect(page.getByTestId('deck-size')).toHaveText('4 cards')
    await expect(branchRow(page, 'Aggro')).toContainText('4')
    const aggro = page.url()

    // AC-2: clicking a branch shows it; Main has no branch in the URL.
    await branchRow(page, 'Main').getByRole('button').first().click()
    await expect(page).not.toHaveURL(/branch=/)
    await expect(page.getByTestId('deck-size')).toHaveText('5 cards')
    await expect(page.getByTestId('deck-branch')).toHaveCount(0)
    await expect(deckRow(page, 'Forest')).toBeVisible()

    // A link opens the branch.
    await page.goto(aggro)
    await expect(page.getByTestId('deck-branch')).toHaveText('Aggro')
    await expect(page.getByTestId('deck-size')).toHaveText('4 cards')
    await expect(deckRow(page, 'Forest')).toHaveCount(0)

    // Branch names are unique in a deck.
    await page.getByTestId('new-branch').click()
    const dialog = page.getByTestId('branch-dialog')
    await dialog.getByLabel('Name').fill('aggro')
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog).toContainText('This deck already has a branch with that name.')
  })

  test('AC-4: rename, make Main, delete; Main can\'t be deleted', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Renames', 'casual', { text: 'Deck\n4 Lightning Bolt' })
    await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Aggro' })
    await page.goto(`/decks/${deck.id}`)
    await showVersions(page)

    await branchMenu(page, 'Aggro', 'Rename')
    await nameBranch(page, 'Burn', 'Save')
    await expect(branchRow(page, 'Burn')).toBeVisible()

    // Main has no Make Main or Delete.
    await branchRow(page, 'Main').hover()
    await branchRow(page, 'Main').getByTestId('branch-menu').click()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Make Main' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await branchMenu(page, 'Burn', 'Make Main')
    await confirmWith(page, 'Make Main')
    await expect(page.getByText('Burn is Main.')).toBeVisible()
    await expect(page.getByTestId('branch-name')).toHaveText(['Burn', 'Main'])
    await expect(branchRow(page, 'Burn').getByLabel('Main')).toBeVisible()
    // Still on the same list, now an ordinary branch.
    await expect(branchRow(page, 'Main')).toHaveAttribute('data-current', 'true')
    await expect(page.getByTestId('deck-branch')).toHaveText('Main')

    await branchMenu(page, 'Main', 'Delete')
    await confirmWith(page, 'Delete')
    await expect(page.getByText('Deleted Main.')).toBeVisible()
    await expect(page.getByTestId('branch-name')).toHaveText(['Burn'])
    await expect(page).not.toHaveURL(/branch=/)
  })

  test('AC-5, AC-6: the deck box and scanning on Main only; elsewhere a deck is its Main', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Mains', 'casual', { text: 'Deck\n4 Lightning Bolt' })
    const { created } = await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Big' })
    await api.post(`/api/decks/${deck.id}/import/?branch=${created}`, { text: '2 Shivan Dragon' })

    await page.goto(`/decks/${deck.id}?branch=${created}`)
    await expect(page.getByTestId('deck-size')).toHaveText('6 cards')
    await expect(page.getByRole('button', { name: 'Scan cards' })).toHaveCount(0)
    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('menuitem', { name: 'Create deck box' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByRole('button', { name: 'Scan cards' })).toBeVisible()
    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('menuitem', { name: 'Create deck box' })).toBeVisible()
    await page.keyboard.press('Escape')

    // AC-6: the deck list counts Main.
    await page.goto('/decks')
    await expect(page.getByTestId('deck-tile').filter({ hasText: 'Mains' }).getByTestId('deck-tile-counts')).toContainText('4 cards')
  })
})
