import { expect, test } from '@playwright/test'
import { deckRow, signUpAndLogIn } from './helpers'
import { branchRow, confirmWith, nameBranch, saveVersion, showVersions, versionMenu, versionRow } from './version-helpers'

// Spec 027: saved versions (AC-7 to AC-11).
test.describe('Deck versions', () => {
  test('AC-7, AC-8: save versions, newest first; view one read only, in the URL', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Versions', 'casual', { text: 'Deck\n4 Lightning Bolt\n1 Forest' })
    await page.goto(`/decks/${deck.id}`)
    await showVersions(page)
    await expect(page.getByTestId('version')).toHaveCount(0)

    await saveVersion(page, 'Burn', 'Before the dragons')
    await expect(page.getByText('Saved Main v1.')).toBeVisible()
    await api.post(`/api/decks/${deck.id}/import/`, { text: '1 Shivan Dragon' })
    await page.reload()
    await saveVersion(page)
    await expect(page.getByTestId('version')).toHaveCount(2)
    await expect(page.getByTestId('version').first()).toContainText('v2')
    await expect(versionRow(page, 1).getByTestId('version-name')).toHaveText('Burn')
    await expect(versionRow(page, 1)).toContainText(String(new Date().getFullYear()))

    // AC-8: read only, under a bar; Deck, Stats and Combos show the version's list.
    await versionRow(page, 1).getByRole('button').first().click()
    await expect(page).toHaveURL(/[?&]version=\d+/)
    await expect(page.getByTestId('version-bar')).toContainText('Viewing Main v1 · Burn')
    await expect(page.getByTestId('deck-size')).toHaveText('5 cards')
    await expect(deckRow(page, 'Shivan Dragon')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
    await deckRow(page, 'Forest').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Stats' }).click()
    await expect(page.getByTestId('version-bar')).toBeVisible()
    await page.getByRole('tab', { name: 'Combos' }).click()
    await expect(page.getByTestId('version-bar')).toBeVisible()

    // A link opens it; Back returns to the branch.
    await page.reload()
    await expect(page.getByTestId('version-bar')).toContainText('Viewing Main v1')
    await page.getByTestId('version-back').click()
    await expect(page.getByTestId('version-bar')).toHaveCount(0)
    await expect(page).not.toHaveURL(/version=/)
    await expect(page.getByTestId('deck-size')).toHaveText('6 cards')
  })

  test('AC-9 to AC-11: branch from a version, restore one, delete one', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Restores', 'casual', { text: 'Deck\n4 Lightning Bolt\n1 Forest' })
    const main = (await api.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    await api.post(`/api/decks/${deck.id}/branches/${main}/versions/`, { name: 'Lean' })
    await api.post(`/api/decks/${deck.id}/import/`, { text: '2 Shivan Dragon' })
    await page.goto(`/decks/${deck.id}`)
    await showVersions(page)

    // AC-9: from the bar while viewing it.
    await versionMenu(page, 1, 'View')
    await page.getByTestId('version-bar').getByRole('button', { name: 'Branch from it' }).click()
    await expect(page.getByTestId('branch-dialog').getByLabel('Name')).toHaveValue('Main v1')
    await nameBranch(page, 'Lean list')
    await expect(page.getByTestId('version-bar')).toHaveCount(0)
    await expect(branchRow(page, 'Lean list')).toHaveAttribute('data-current', 'true')
    await expect(branchRow(page, 'Lean list').getByTestId('branch-from')).toHaveText('from Main v1')
    await expect(page.getByTestId('deck-size')).toHaveText('5 cards')

    // AC-10: Main's list now is saved first, then replaced.
    await branchRow(page, 'Main').getByRole('button').first().click()
    await expect(page.getByTestId('deck-size')).toHaveText('7 cards')
    await versionMenu(page, 1, 'Restore')
    await expect(page.getByRole('alertdialog')).toContainText('saved first, as "Before restoring v1"')
    await confirmWith(page, 'Restore')
    await expect(page.getByText('Restored Main v1.')).toBeVisible()
    await expect(page.getByTestId('deck-size')).toHaveText('5 cards')
    await expect(versionRow(page, 2).getByTestId('version-name')).toHaveText('Before restoring v1')
    await expect(versionRow(page, 2)).toContainText('7')

    // AC-11
    await versionMenu(page, 2, 'Delete')
    await confirmWith(page, 'Delete')
    await expect(page.getByText('Deleted Main v2.')).toBeVisible()
    await expect(page.getByTestId('version')).toHaveCount(1)
  })
})
