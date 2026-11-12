import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, dropEmptySeats, openSimulations, pickDeck, rows, runCard, seats, startRun, waitForRun } from './sim-helpers'

// Spec 027: deck lists in Simulations (AC-16 to AC-19). Fake Forge draws every game of a deck
// whose name holds "Stalls", so a branch named Stalls loses to Main.
test.describe('Simulations of deck versions', () => {
  test('AC-16: a seat picks Main, a branch or a version; runs name the list and the search finds it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const name = `Listed ${stamp}`
    const deck = await commanderDeck(api, name)
    const piper = await commanderDeck(api, `Listed Piper ${stamp}`, PIPER)
    const main = (await api.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    await api.post(`/api/decks/${deck.id}/branches/${main}/versions/`, { name: 'Start' })
    await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Stalls' })

    await openSimulations(page)
    await pickDeck(page, 1, 'My decks', name)
    const list = seats(page).first().getByTestId('seat-list')
    await expect(list).toHaveText('Main (current)')
    await list.click()
    await expect(page.getByRole('option')).toHaveText(['Main (current)', 'Main v1 · Start', 'Stalls (current)'])
    await page.getByRole('option', { name: 'Main v1 · Start' }).click()
    await pickDeck(page, 2, 'My decks', `Listed Piper ${stamp}`)
    await expect(seats(page).nth(1).getByTestId('seat-list')).toHaveCount(0) // one list only
    await dropEmptySeats(page)
    await page.getByLabel('Games').fill('1')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    await page.getByLabel('Search runs').fill(`${name} · main v1`)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first().getByTestId('run-row-deck')).toHaveText(`${name} · Main v1`)

    // A branch's list now, through the API.
    const run = await startRun(api, { deck: deck.id, branch: (await api.get(`/api/decks/${deck.id}/branches/`)).branches[1].id } as never, [{ deck: piper.id }])
    expect(run.seats[0].label).toBe(`${name} · Stalls`)
    expect((await waitForRun(api, run.id)).results.map((g: { status: string }) => g.status)).toEqual(['draw', 'draw'])
  })

  test('AC-17, AC-18: Compare versions in one run: each list plays the same games, side by side', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const name = `Compared ${stamp}`
    const deck = await commanderDeck(api, name)
    await commanderDeck(api, `Compared Piper ${stamp}`, PIPER)
    await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Stalls' })

    await openSimulations(page)
    await pickDeck(page, 1, 'My decks', name)
    await pickDeck(page, 2, 'My decks', `Compared Piper ${stamp}`)
    await dropEmptySeats(page)
    await page.getByLabel('Games').fill('2')
    await page.getByTestId('compare-versions').click()
    await expect(seats(page).first().getByTestId('seat-list')).toHaveCount(0)
    const lists = page.getByTestId('compare-lists')
    await lists.getByLabel('Main (current)').click()
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled() // 2 to 4 lists
    await lists.getByLabel('Stalls (current)').click()
    await expect(page.getByRole('button', { name: 'One run' })).toHaveAttribute('data-state', 'on')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    const found = (await api.get(`/api/sims/runs/?q=${stamp}`)).results
    expect(found).toHaveLength(1)
    const run = await waitForRun(api, found[0].id)
    expect(run.games).toBe(4)
    // The same seat orders and seeds for each list.
    const orders = (v: number) => run.results.filter((g: { variant: number }) => g.variant === v).map((g: { seat_order: number[] }) => g.seat_order.join())
    expect(orders(0)).toEqual(orders(1))

    await page.goto(`/simulations/${run.id}`)
    await expect(runCard(page)).toContainText('2 lists × 2 games')
    const table = runCard(page).getByTestId('run-list')
    await expect(table).toHaveCount(2)
    await expect(table.first()).toContainText(name)
    await expect(table.first().getByTestId('run-list-win-rate')).toHaveText('50%')
    await expect(table.nth(1)).toContainText(`${name} · Stalls`)
    await expect(table.nth(1).getByTestId('run-list-win-rate')).toHaveText('0%')
    await expect(runCard(page).getByTestId('game-result')).toContainText([/won/, /won/, 'Draw', 'Draw'])
    await expect(runCard(page).getByTestId('game-seats').nth(2)).toContainText(`${name} · Stalls`)

    // The list shows the best list's win rate, with its name.
    await openSimulations(page)
    await page.getByLabel('Search runs').fill(String(stamp))
    await expect(rows(page).first().getByTestId('run-row-deck')).toHaveText(name)
    await expect(rows(page).first().getByTestId('run-row-lists')).toHaveText('2 lists')
    await expect(rows(page).first().getByTestId('run-row-win-rate')).toHaveText('50%')
  })

  test('AC-19: separate runs show as one row that opens their comparison; each run keeps its page', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const name = `Separate ${stamp}`
    const deck = await commanderDeck(api, name)
    const piper = await commanderDeck(api, `Separate Piper ${stamp}`, PIPER)
    const { created } = await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Stalls' })
    await startRun(api, deck.id, [{ deck: piper.id }], { compare: { lists: [{}, { branch: created }], mode: 'separate' } })
    const found = (await api.get(`/api/sims/runs/?q=${stamp}`)).results
    expect(found).toHaveLength(1)
    const group = found[0].group
    expect(group.runs).toHaveLength(2)
    await waitForRun(api, group.runs[1].id)

    await openSimulations(page)
    await page.getByLabel('Search runs').fill(`${name} · stalls`)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first().getByTestId('run-row-deck')).toHaveText(`${name} / ${name} · Stalls`)
    await expect(rows(page).first().getByTestId('run-row-lists')).toHaveText('2 runs')
    await rows(page).first().click()
    await expect(page).toHaveURL(new RegExp(`/simulations/groups/${group.id}$`))
    const runs = page.getByTestId('group-run')
    await expect(runs).toHaveCount(2)
    await expect(runs.first()).toContainText(name)
    await expect(runs.nth(1)).toContainText(`${name} · Stalls`)
    await expect(runs.nth(1).getByTestId('group-run-win-rate')).toHaveText('0%')
    await runs.nth(1).getByRole('link', { name: 'Run' }).click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${group.runs[1].id}$`))
    await expect(runCard(page)).toBeVisible()
  })
})
