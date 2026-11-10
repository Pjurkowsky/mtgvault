import { expect, test } from '@playwright/test'
import { choose, signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, dropEmptySeats, openSimulate, pickOpponent, picker, runs, seats, waitForRun } from './sim-helpers'

// Spec 024, AC-3 to AC-7: the run form.
test.describe('Pod', () => {
  test('AC-3, AC-4: four seats to start, up to six, picked from the pool, my decks and public decks', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await commanderDeck(api, 'Pod Krenko')
    await commanderDeck(api, 'Pod Piper', PIPER)
    await openSimulate(page, deck.id)

    await expect(seats(page)).toHaveCount(4)
    await expect(seats(page).first().getByTestId('seat-tile')).toContainText('Pod Krenko')
    await expect(seats(page).first().getByRole('button', { name: 'Remove seat' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled()
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Add seat' }).click()
    await expect(seats(page)).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Add seat' })).toHaveCount(0)

    // Pool (Forge's precons), my decks, searchable by commander name too.
    await seats(page).nth(1).getByRole('button', { name: 'Choose opponent' }).click()
    await expect(picker(page).getByTestId('opponents-pool').getByTestId('opponent')).toContainText(['Ahoy Mateys [LCC] [2023]'])
    await picker(page).getByLabel('Search opponents').fill('Prismatic')
    await picker(page).getByRole('tab', { name: 'My decks' }).click()
    await expect(picker(page).getByTestId('opponents-mine').getByTestId('opponent')).toHaveText([/Pod Piper/])
    await page.keyboard.press('Escape')
    await expect(picker(page)).toBeHidden()
    await pickOpponent(page, 2, 'Opponent pool', 'Animated Army [BLC] [2024]')
    await pickOpponent(page, 3, 'My decks', 'Pod Piper')
    await expect(seats(page).nth(2).getByTestId('seat-tile')).toContainText('The Prismatic Piper')
    await dropEmptySeats(page)
    await expect(seats(page)).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled()
    // At least one opponent: two seats can't shrink further.
    await seats(page).nth(2).getByRole('button', { name: 'Remove seat' }).click()
    await expect(seats(page).nth(1).getByRole('button', { name: 'Remove seat' })).toBeDisabled()
  })

  test('AC-5 to AC-7: AI profiles, Fixed order, games and time limit reach the run', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await commanderDeck(api, 'Order Krenko')
    await commanderDeck(api, 'Order Piper', PIPER)
    await openSimulate(page, deck.id)
    await pickOpponent(page, 2, 'My decks', 'Order Piper')
    await dropEmptySeats(page)

    await expect(page.getByRole('combobox', { name: 'AI profile, seat 2' })).toHaveText('Default')
    await choose(page, 'AI profile, seat 2', 'Reckless')
    // Fixed: the order of the form; the Piper goes first.
    await choose(page, 'Seat order', 'Fixed')
    await seats(page).nth(1).getByRole('button', { name: 'Move up' }).click()
    await expect(seats(page).first().getByTestId('seat-tile')).toContainText('Order Piper')
    await page.getByLabel('Games').fill('3')
    await page.getByLabel('Time limit (min)').fill('2')
    await page.getByRole('button', { name: 'Run' }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    const [run] = await api.get(`/api/decks/${deck.id}/sims/`)
    expect(run).toMatchObject({ games: 3, minutes: 2, seat_mode: 'fixed', fixed_order: [1, 0] })
    expect(run.seats.map((s: { label: string; profile: string }) => [s.label, s.profile])).toEqual([['Order Krenko', 'Default'], ['Order Piper', 'Reckless']])
    const done = await waitForRun(api, run.id)
    expect(done.results.map((g: { seat_order: number[] }) => g.seat_order)).toEqual([[1, 0], [1, 0], [1, 0]])
    await expect(runs(page).first().getByTestId('pod-row').nth(1)).toContainText('3') // went first 3 times

    // Rotate (the default) moves the first seat each game; a long run warns.
    await choose(page, 'Seat order', 'Rotate')
    await page.getByLabel('Games').fill('200')
    await page.getByLabel('Time limit (min)').fill('5')
    await expect(page.getByTestId('sim-long')).toHaveText('This run could take up to 17 hours.')
    await page.getByLabel('Games').fill('0')
    await expect(page.getByRole('button', { name: 'Run' })).toBeDisabled()
    const rotate = await api.post(`/api/decks/${deck.id}/sims/`, { seats: [{ deck: deck.id }, { deck: run.seats[1].source_id }], games: 3, minutes: 1 })
    expect((await waitForRun(api, rotate.id)).results.map((g: { seat_order: number[] }) => g.seat_order)).toEqual([[0, 1], [1, 0], [0, 1]])
  })
})
