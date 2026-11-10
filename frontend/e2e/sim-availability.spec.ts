import { expect, test } from '@playwright/test'
import { createUser, logOut, signUpAndLogIn, uniqueUser } from './helpers'
import { commanderDeck } from './sim-helpers'

// Spec 024, AC-1: the Simulate tab on Commander decks when the server has Forge.
test.describe('Simulate tab', () => {
  test('AC-1: Commander decks have it, for the owner and visitors; other formats and servers without Forge don\'t', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await commanderDeck(api, 'Sim tab', undefined, { is_public: true })
    const casual = await api.deck('Sim casual', 'casual', { text: '1 Sol Ring' })
    const empty = await api.deck('Sim no commander', 'commander', { text: '1 Sol Ring' })

    await page.goto(`/decks/${deck.id}`)
    await page.getByRole('tab', { name: 'Simulate' }).click()
    await expect(page).toHaveURL(/tab=simulate/)
    await expect(page.getByTestId('sim-form')).toBeVisible()

    await page.goto(`/decks/${casual.id}`)
    await expect(page.getByRole('tab', { name: 'Stats' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Simulate' })).toHaveCount(0)

    // A Commander deck without a commander says so.
    await page.goto(`/decks/${empty.id}?tab=simulate`)
    await expect(page.getByText('Add a commander to simulate this deck.')).toBeVisible()

    // A visitor of the public deck sees the tab and can run it.
    await logOut(page)
    const other = uniqueUser('v')
    await createUser(request, other)
    await page.goto(`/u/${user.username}/decks/${deck.id}`)
    await expect(page.getByRole('tab', { name: 'Simulate' })).toBeVisible()

    // Without a Forge service the tab is hidden.
    await page.route('**/api/sims/status/', (route) => route.fulfill({ json: { available: false, version: '' } }))
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Stats' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Simulate' })).toHaveCount(0)
  })
})
