import { expect, test } from '@playwright/test'
import { choose, signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, dropEmptySeats, openSimulations, pickDeck, picker, seats, waitForRun } from './sim-helpers'

// Spec 024, AC-3 to AC-7, as moved to the Simulations page by spec 025 (AC-3, AC-5).
test.describe('Pod', () => {
  test('Spec 025 AC-3, spec 024 AC-4: four empty seats, the first is Tested, up to six, from the pool, my decks and public decks', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    await commanderDeck(api, `Pod Krenko ${stamp}`)
    await commanderDeck(api, `Pod Piper ${stamp}`, PIPER)
    await openSimulations(page)

    await expect(seats(page)).toHaveCount(4)
    await expect(seats(page).first().getByTestId('seat-tested')).toHaveText('Tested')
    await expect(seats(page).first().getByRole('button', { name: 'Choose deck' })).toBeVisible()
    await expect(seats(page).first().getByRole('button', { name: 'Remove seat' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Add seat' }).click()
    await expect(seats(page)).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Add seat' })).toHaveCount(0)

    // The tested deck comes from the same picker.
    await seats(page).first().getByRole('button', { name: 'Choose deck' }).click()
    await expect(picker(page).getByRole('heading', { name: 'Choose deck' })).toBeVisible()
    await page.keyboard.press('Escape')
    await pickDeck(page, 1, 'My decks', `Pod Krenko ${stamp}`)
    await expect(seats(page).first().getByTestId('seat-tile')).toContainText(`Pod Krenko ${stamp}`)

    // Pool (Forge's precons), my decks, searchable by commander name too.
    await seats(page).nth(1).getByRole('button', { name: 'Choose opponent' }).click()
    await expect(picker(page).getByRole('heading', { name: 'Choose opponent' })).toBeVisible()
    await expect(picker(page).getByTestId('opponents-pool').getByTestId('opponent')).toContainText(['Ahoy Mateys [LCC] [2023]'])
    await picker(page).getByLabel('Search opponents').fill(`Pod Piper ${stamp}`)
    await picker(page).getByRole('tab', { name: 'My decks' }).click()
    await expect(picker(page).getByTestId('opponents-mine').getByTestId('opponent')).toHaveText([/The Prismatic Piper/])
    await page.keyboard.press('Escape')
    await expect(picker(page)).toBeHidden()
    await pickDeck(page, 2, 'Opponent pool', 'Animated Army [BLC] [2024]')
    await pickDeck(page, 3, 'My decks', `Pod Piper ${stamp}`)
    await expect(seats(page).nth(2).getByTestId('seat-tile')).toContainText('The Prismatic Piper')
    await dropEmptySeats(page)
    await expect(seats(page)).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
    // At least one opponent: two seats can't shrink further.
    await seats(page).nth(2).getByRole('button', { name: 'Remove seat' }).click()
    await expect(seats(page).nth(1).getByRole('button', { name: 'Remove seat' })).toBeDisabled()
  })

  test('Spec 024 AC-5 to AC-7: AI profiles, Fixed order, games and time limit reach the run', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Order Krenko ${stamp}`)
    const piper = await commanderDeck(api, `Order Piper ${stamp}`, PIPER)
    await openSimulations(page)
    await pickDeck(page, 1, 'My decks', `Order Krenko ${stamp}`)
    await pickDeck(page, 2, 'My decks', `Order Piper ${stamp}`)
    await dropEmptySeats(page)

    await expect(page.getByRole('combobox', { name: 'AI profile, seat 2' })).toHaveText('Default')
    await choose(page, 'AI profile, seat 2', 'Reckless')
    // Fixed: the order of the form; the Piper goes first, Krenko stays the tested deck.
    await choose(page, 'Seat order', 'Fixed')
    await seats(page).nth(1).getByRole('button', { name: 'Move up' }).click()
    await expect(seats(page).first().getByTestId('seat-tile')).toContainText(`Order Piper ${stamp}`)
    await expect(seats(page).nth(1).getByTestId('seat-tested')).toBeVisible()
    await page.getByLabel('Games').fill('3')
    await page.getByLabel('Time limit (min)').fill('2')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    const [row] = (await api.get(`/api/sims/runs/?mine=1&q=Order Krenko ${stamp}`)).results
    const run = await api.get(`/api/sims/runs/${row.id}/`)
    expect(run).toMatchObject({ deck: deck.id, games: 3, minutes: 2, seat_mode: 'fixed', fixed_order: [1, 0] })
    expect(run.seats.map((s: { label: string; profile: string }) => [s.label, s.profile])).toEqual([[`Order Krenko ${stamp}`, 'Default'], [`Order Piper ${stamp}`, 'Reckless']])
    const done = await waitForRun(api, run.id)
    expect(done.results.map((g: { seat_order: number[] }) => g.seat_order)).toEqual([[1, 0], [1, 0], [1, 0]])

    // Rotate (the default) moves the first seat each game; a long run warns.
    await choose(page, 'Seat order', 'Rotate')
    await page.getByLabel('Games').fill('200')
    await page.getByLabel('Time limit (min)').fill('5')
    await expect(page.getByTestId('sim-long')).toHaveText('This run could take up to 17 hours.')
    await page.getByLabel('Games').fill('0')
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
    const rotate = await api.post('/api/sims/runs/', { seats: [{ deck: deck.id }, { deck: piper.id }], games: 3, minutes: 1 })
    expect((await waitForRun(api, rotate.id)).results.map((g: { seat_order: number[] }) => g.seat_order)).toEqual([[0, 1], [1, 0], [0, 1]])
  })
})
