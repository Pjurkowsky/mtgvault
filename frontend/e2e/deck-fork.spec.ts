import { expect, test } from '@playwright/test'
import { apiAs, createUser, deckRow, signUpAndLogIn, uniqueUser } from './helpers'
import { branchRow, hideVersions, showVersions, versionMenu, versionRow } from './version-helpers'

// Spec 027: others' decks read only, and forks (AC-14, AC-15).
test.describe('Deck forks', () => {
  test('AC-14, AC-15: others see the panel read only and fork a branch; the fork links back', async ({ page, request }) => {
    const owner = uniqueUser('own')
    await createUser(request, owner)
    const theirs = await apiAs(request, owner)
    const deck = await theirs.deck('Shared', 'casual', { text: 'Deck\n4 Lightning Bolt\n1 Forest', is_public: true })
    const main = (await theirs.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    await theirs.post(`/api/decks/${deck.id}/branches/${main}/versions/`, { name: 'Start' })
    const { created } = await theirs.post(`/api/decks/${deck.id}/branches/`, { name: 'Dragons' })
    await theirs.post(`/api/decks/${deck.id}/import/?branch=${created}`, { text: '2 Shivan Dragon' })

    await signUpAndLogIn(page, request)
    await page.goto(`/u/${owner.username}/decks/${deck.id}`)
    await showVersions(page)

    // AC-14: switch, view, compare; no saving or changing.
    await expect(page.getByTestId('new-branch')).toHaveCount(0)
    await expect(page.getByTestId('save-version')).toHaveCount(0)
    await expect(page.getByTestId('branch-menu')).toHaveCount(0)
    await versionRow(page, 1).hover()
    await versionRow(page, 1).getByTestId('version-menu').click()
    await expect(page.getByRole('menuitem')).toHaveText(['View', 'Compare'])
    await page.keyboard.press('Escape')
    await versionMenu(page, 1, 'View')
    await expect(page.getByTestId('version-bar')).toContainText('Viewing Main v1 · Start')
    await expect(page.getByTestId('version-bar').getByRole('button', { name: 'Restore' })).toHaveCount(0)
    await page.getByTestId('version-back').click()
    await branchRow(page, 'Dragons').getByRole('button').first().click()
    await expect(page.getByTestId('deck-size')).toHaveText('7 cards')
    await page.getByTestId('compare').click()
    await expect(page.getByTestId('compare-dialog').getByTestId('compare-added')).toContainText('Shivan Dragon')
    await page.keyboard.press('Escape')

    // AC-15: the branch shown becomes the fork's Main; every branch and version comes along.
    await hideVersions(page)
    await page.getByTestId('fork').click()
    await expect(page.getByText('Forked Shared into your decks.')).toBeVisible()
    await expect(page).toHaveURL(/\/decks\/\d+$/)
    await expect(page.getByTestId('deck-name')).toHaveText('Shared')
    await expect(page.getByTestId('deck-size')).toHaveText('7 cards')
    await expect(deckRow(page, 'Shivan Dragon')).toBeVisible()
    await expect(page.getByTestId('forked-from')).toHaveText(`Forked from ${owner.username} / Shared`)
    await expect(page.getByTestId('forked-from').getByRole('link')).toHaveAttribute('href', `/u/${owner.username}/decks/${deck.id}`)
    await showVersions(page)
    await expect(page.getByTestId('branch-name')).toHaveText(['Dragons', 'Main'])
    await branchRow(page, 'Main').getByRole('button').first().click()
    await expect(page.getByTestId('version')).toHaveCount(1)
    // Private.
    await expect(page.getByLabel('Public')).toHaveCount(0)

    // The original counts its forks.
    expect((await theirs.get(`/api/decks/${deck.id}/`)).fork_count).toBe(1)
    await page.goto(`/u/${owner.username}/decks/${deck.id}`)
    await expect(page.getByTestId('fork-count')).toHaveText('1 fork')
  })

  test('AC-15: fork your own deck from a version; it is named so it doesn\'t clash', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Mine', 'casual', { text: 'Deck\n4 Lightning Bolt' })
    const main = (await api.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    await api.post(`/api/decks/${deck.id}/branches/${main}/versions/`, {})
    await api.post(`/api/decks/${deck.id}/import/`, { text: '1 Forest' })

    await page.goto(`/decks/${deck.id}`)
    await showVersions(page)
    await versionMenu(page, 1, 'View')
    await hideVersions(page)
    await page.getByTestId('fork').click()
    await expect(page.getByTestId('deck-name')).toHaveText('Mine (2)')
    await expect(page.getByTestId('deck-size')).toHaveText('4 cards')
    await showVersions(page)
    await expect(page.getByTestId('branch-name')).toHaveText(['Main v1', 'Main'])
    await expect(page.getByTestId('forked-from').getByRole('link')).toHaveAttribute('href', `/decks/${deck.id}`)
  })
})
