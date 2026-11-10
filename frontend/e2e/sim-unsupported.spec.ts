import { expect, test } from '@playwright/test'
import { apiAs, createUser, logIn, logOut, signUpAndLogIn, uniqueUser } from './helpers'
import { KRENKO, commanderDeck, dropEmptySeats, openSimulate, pickOpponent, runs, waitForRun } from './sim-helpers'

// Spec 024, AC-11 to AC-13: cards Forge can't play get stand-ins, for simulations only.
const LIST = KRENKO.replace('36 Forest', '34 Forest\n1 Dockside Extortionist\n1 Shivan Dragon')
const step = (page: import('@playwright/test').Page) => page.getByTestId('sim-swaps')

test.describe('Unsupported cards', () => {
  test.describe.configure({ timeout: 90_000 })

  test('AC-11 to AC-13: every unsupported card needs a stand-in; your deck stays, your swaps are remembered', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Odd cards ${stamp}`, LIST, { is_public: true })
    await openSimulate(page, deck.id)
    await pickOpponent(page, 2, 'Opponent pool', 'Ahoy Mateys [LCC] [2023]')
    await dropEmptySeats(page)
    await page.getByLabel('Games').fill('2')
    await page.getByRole('button', { name: 'Run' }).click()

    // AC-11: listed per deck; Save and run waits for every stand-in.
    const mine = step(page).getByTestId(`sim-swaps-Odd cards ${stamp}`)
    await expect(mine.getByTestId('unsupported-card')).toHaveCount(2)
    await expect(step(page).getByTestId('unsupported-card')).toHaveCount(2)
    await expect(step(page).getByRole('button', { name: 'Save and run' })).toBeDisabled()

    // AC-12: suggestions are supported cards sharing the first category, in Krenko's colours.
    const dockside = mine.getByTestId('unsupported-card').filter({ hasText: 'Dockside Extortionist' })
    await expect(dockside.getByTestId('swap-suggestions').getByRole('button')).toHaveText(['Skirk Prospector', 'Sol Ring'])
    await dockside.getByRole('button', { name: 'Skirk Prospector' }).click()
    await expect(dockside.getByTestId('swap-picked')).toContainText('Skirk Prospector')
    // Any card can be typed in.
    const hq = mine.getByTestId('unsupported-card').filter({ hasText: 'Shivan Dragon' })
    await hq.getByLabel('Card name').fill('Forest')
    await hq.getByTestId('card-results').getByRole('button', { name: 'Forest', exact: true }).click()
    await step(page).getByRole('button', { name: 'Save and run' }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    // AC-13: the deck is unchanged; the run used the stand-ins.
    const cards = (await api.get(`/api/decks/${deck.id}/`)).cards.map((c: { printing: { name: string } }) => c.printing.name)
    expect(cards).toEqual(expect.arrayContaining(['Dockside Extortionist', 'Shivan Dragon']))
    const [run] = await api.get(`/api/decks/${deck.id}/sims/`)
    const names = run.seats[0].cards.map((c: { name: string }) => c.name)
    expect(names).toEqual(expect.arrayContaining(['Skirk Prospector', 'Forest']))
    expect(names).not.toContain('Dockside Extortionist')
    await waitForRun(api, run.id)

    // Remembered: the next run's step has them filled in.
    await page.getByRole('button', { name: 'Run' }).click()
    await expect(step(page).getByTestId('swap-picked')).toHaveText([/Skirk Prospector/, /Forest/])
    await step(page).getByRole('button', { name: 'Save and run' }).click()
    await expect(runs(page)).toHaveCount(2)

    // Another user simulating the public deck chooses their own.
    await logOut(page)
    const other = uniqueUser('w')
    await createUser(request, other)
    await logIn(page, other.username, other.password)
    await expect(page.getByTestId('user-menu')).toHaveText(other.username)
    await openSimulate(page, deck.id, user.username)
    await pickOpponent(page, 2, 'Opponent pool', 'Ahoy Mateys [LCC] [2023]')
    await dropEmptySeats(page)
    await page.getByRole('button', { name: 'Run' }).click()
    await expect(step(page).getByTestId('unsupported-card')).toHaveCount(2)
    await expect(step(page).getByTestId('swap-picked')).toHaveCount(0)
  })

  test('AC-11, AC-13: opponents get the step too; a pool deck\'s stand-in changes the pool copy for everyone', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Clean ${stamp}`)
    const { id: poolId } = await api.post('/api/sims/pool/', { name: `Odd pool ${stamp}`, text: LIST.replace('1 Dockside Extortionist\n', '1 Forest\n') })
    await openSimulate(page, deck.id)
    await pickOpponent(page, 2, 'Opponent pool', `Odd pool ${stamp}`)
    await dropEmptySeats(page)
    await page.getByLabel('Games').fill('1')
    await page.getByRole('button', { name: 'Run' }).click()
    const odd = step(page).getByTestId(`sim-swaps-Odd pool ${stamp}`)
    await expect(odd.getByTestId('unsupported-card')).toHaveText([/Shivan Dragon/])
    await odd.getByLabel('Card name').fill('Sol Ring')
    await odd.getByTestId('card-results').getByRole('button', { name: 'Sol Ring', exact: true }).click()
    await step(page).getByRole('button', { name: 'Save and run' }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    // Everyone now sees the pool deck without the unsupported card.
    const other = uniqueUser('x')
    await createUser(request, other)
    const otherApi = await apiAs(request, other)
    const theirs = await commanderDeck(otherApi, `Theirs ${stamp}`)
    const check = await otherApi.post('/api/sims/check/', { seats: [{ deck: theirs.id }, { pool: poolId }] })
    expect(check[1].unsupported).toEqual([])
  })
})
