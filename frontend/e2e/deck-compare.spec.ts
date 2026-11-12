import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'
import { showVersions, versionMenu } from './version-helpers'

// Spec 027: compare two lists of a deck (AC-12, AC-13).
test.describe('Deck compare', () => {
  test('AC-12, AC-13: a version against the branch now; added, removed, quantity changed, moved; swap sides', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Compares', 'casual', { text: 'Deck\n4 Lightning Bolt\n10 Forest\n1 Counterspell' })
    const main = (await api.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    await api.post(`/api/decks/${deck.id}/branches/${main}/versions/`, { name: 'First' })
    // Now: Forest 10 → 8, Counterspell to the Maybeboard, Shivan Dragon added, Bolt removed.
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards as { id: number; printing: { name: string } }[]
    const id = (name: string) => cards.find((c) => c.printing.name === name)!.id
    await api.patch(`/api/decks/${deck.id}/cards/${id('Forest')}/`, { quantity: 8 })
    await api.patch(`/api/decks/${deck.id}/cards/${id('Counterspell')}/`, { zone: 'maybe' })
    await api.delete(`/api/decks/${deck.id}/cards/${id('Lightning Bolt')}/`)
    await api.post(`/api/decks/${deck.id}/import/`, { text: '2 Shivan Dragon' })

    await page.goto(`/decks/${deck.id}`)
    await showVersions(page)
    await versionMenu(page, 1, 'Compare')
    const dialog = page.getByTestId('compare-dialog')
    await expect(dialog.getByTestId('compare-a')).toHaveText('Main v1 · First')
    await expect(dialog.getByTestId('compare-b')).toHaveText('Main (now)')
    await expect(dialog.getByTestId('compare-added')).toContainText('Shivan Dragon')
    await expect(dialog.getByTestId('compare-added')).toContainText('+2 · Mainboard')
    await expect(dialog.getByTestId('compare-removed')).toContainText('Lightning Bolt')
    await expect(dialog.getByTestId('compare-removed')).toContainText('−4 · Mainboard')
    await expect(dialog.getByTestId('compare-changed')).toContainText('Forest')
    await expect(dialog.getByTestId('compare-changed').getByTestId('compare-card')).toContainText(/10\s*8/)
    await expect(dialog.getByTestId('compare-moved')).toContainText('Counterspell')
    await expect(dialog.getByTestId('compare-moved')).toContainText(/1 × Mainboard\s*Maybeboard/)
    await expect(dialog.getByTestId('compare-card').first().getByRole('img')).toBeVisible()
    await expect(dialog.getByTestId('compare-totals')).toHaveText('+2 −6')

    // ⇄ turns it around.
    await dialog.getByTestId('compare-swap').click()
    await expect(dialog.getByTestId('compare-a')).toHaveText('Main (now)')
    await expect(dialog.getByTestId('compare-added')).toContainText('Lightning Bolt')
    await expect(dialog.getByTestId('compare-totals')).toHaveText('+6 −2')

    // The same list on both sides.
    await dialog.getByTestId('compare-b').click()
    await page.getByRole('option', { name: 'Main (now)' }).click()
    await expect(dialog).toContainText('No changes')
  })
})
