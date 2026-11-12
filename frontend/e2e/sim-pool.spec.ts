import { expect, test } from '@playwright/test'
import { apiAs, createUser, signUpAndLogIn, uniqueUser } from './helpers'
import { commanderDeck, openRun, openSimulations, picker, runCard, startRun, waitForRun } from './sim-helpers'

// Spec 024, AC-8 to AC-10: the shared opponent pool; spec 025, AC-4: decks join it from their row.
const pool = (page: import('@playwright/test').Page) => picker(page).getByTestId('opponents-pool').getByTestId('opponent')

test.describe('Opponent pool', () => {
  test('Spec 025 AC-4, spec 024 AC-8 to AC-10: add a deck or a list, anyone renames or removes, runs keep their copy', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Pooled ${stamp}`)
    await openSimulations(page)
    await page.getByTestId('sim-seat').nth(1).getByRole('button', { name: 'Choose opponent' }).click()

    // Spec 024 AC-10: precons show Forge as who added them.
    await picker(page).getByLabel('Search opponents').fill('Ahoy Mateys')
    await expect(pool(page)).toHaveText([/Ahoy Mateys \[LCC\] \[2023\].*Admiral Brass, Unsinkable · Forge/])
    await expect(picker(page).getByRole('button', { name: 'Add this deck to pool' })).toHaveCount(0)

    // Spec 025 AC-4: a deck from My decks, copied, named after it.
    await picker(page).getByLabel('Search opponents').fill(`Pooled ${stamp}`)
    await picker(page).getByRole('tab', { name: 'My decks' }).click()
    await picker(page).getByTestId('opponents-mine').getByRole('button', { name: 'Add to pool' }).click()
    await expect(page.getByText('Added to the opponent pool.')).toBeVisible()
    await expect(picker(page).getByRole('tab', { name: 'Opponent pool' })).toHaveAttribute('data-state', 'active')
    await expect(pool(page)).toHaveText([new RegExp(`Pooled ${stamp}.*Krenko, Mob Boss · ${user.username}`)])
    await expect(pool(page).locator('img')).toHaveAttribute('src', /art_crop/)

    // A pasted list needs a commander, then joins the pool.
    await picker(page).getByRole('button', { name: 'Paste a list' }).click()
    const form = picker(page).getByTestId('pool-add-list')
    await form.getByLabel('Pool deck name').fill(`Pasted ${stamp}`)
    await form.getByLabel('Decklist').fill('Deck\n40 Forest')
    await form.getByRole('button', { name: 'Add to pool' }).click()
    await expect(page.getByText('The list needs a Commander section.')).toBeVisible()
    await form.getByLabel('Decklist').fill('Commander\n1 The Prismatic Piper\n\nDeck\n40 Forest')
    await form.getByRole('button', { name: 'Add to pool' }).click()
    await picker(page).getByLabel('Search opponents').fill(`Pasted ${stamp}`)
    await expect(pool(page)).toHaveText([/The Prismatic Piper/])
    const pasted = (await api.get(`/api/sims/opponents/?q=Pasted ${stamp}`)).pool[0]

    // A run with the pasted deck keeps its copy after the deck is gone (spec 024 AC-9, AC-15).
    const run = await startRun(api, deck.id, [{ pool: pasted.id }], { games: 1 })
    await waitForRun(api, run.id)

    // Spec 024 AC-9: another user renames and removes it, with a confirm.
    const other = uniqueUser('p')
    await createUser(request, other)
    const otherApi = await apiAs(request, other)
    await otherApi.patch(`/api/sims/pool/${pasted.id}/`, { name: `Renamed ${stamp}` })
    await picker(page).getByLabel('Search opponents').fill(`Renamed ${stamp}`)
    await expect(pool(page)).toHaveText([new RegExp(`Renamed ${stamp}`)])
    await pool(page).getByRole('button', { name: 'Rename', exact: true }).click()
    await picker(page).getByLabel('New name').fill(`Mine again ${stamp}`)
    await picker(page).getByRole('button', { name: 'Save name' }).click()
    await picker(page).getByLabel('Search opponents').fill(`Mine again ${stamp}`)
    await pool(page).getByRole('button', { name: 'Remove from pool' }).click()
    await expect(page.getByTestId('confirm-dialog')).toContainText('Runs that used it keep their copy.')
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Remove' }).click()
    await expect(pool(page)).toHaveCount(0)
    await page.keyboard.press('Escape')

    await openRun(page, run.id)
    await expect(runCard(page).getByTestId('pod-row').nth(1)).toContainText(`Pasted ${stamp}`)
    await runCard(page).getByTestId('pod-row').nth(1).getByText(`Pasted ${stamp}`).click()
    await expect(runCard(page).getByTestId('pod-list').nth(1)).toContainText('40 Forest')
  })
})
