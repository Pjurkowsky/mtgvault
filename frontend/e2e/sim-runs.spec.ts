import { expect, test } from '@playwright/test'
import { createUser, signUpAndLogIn, uniqueUser } from './helpers'
import { PIPER, commanderDeck, openRun, openSimulations, runCard, startRun, waitForRun } from './sim-helpers'

// Spec 024, AC-14 to AC-22: the queue, runs and results; the queue on the Simulations page and a
// run's results on its own page since spec 025 (AC-8, AC-11).
test.describe('Runs', () => {
  test.describe.configure({ timeout: 120_000 })

  test('Spec 024 AC-14, AC-16, AC-17: one run at a time, the queue, cancel and delete by who started it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const hangs = await commanderDeck(api, `Hangs ${stamp}`, undefined, { is_public: true })
    const piper = await commanderDeck(api, `Queue Piper ${stamp}`, PIPER)
    const playing = await startRun(api, hangs.id, [{ deck: piper.id }])
    const queued = await startRun(api, piper.id, [{ deck: hangs.id }])
    await openSimulations(page)

    // AC-14: the queue shows the playing run and mine, highlighted; one plays at a time.
    const entry = (name: string) => page.getByTestId('queue-entry').filter({ hasText: name })
    await expect(entry(`Hangs ${stamp}`)).toContainText(/Playing.*0 \/ 2/)
    await expect(entry(`Queue Piper ${stamp}`)).toContainText(/Queued \d+/)
    await expect(entry(`Queue Piper ${stamp}`)).toHaveAttribute('data-mine', 'true')

    // AC-17: a queued run cancels at once, from its page.
    await entry(`Queue Piper ${stamp}`).getByRole('link', { name: `Queue Piper ${stamp}` }).click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${queued.id}$`))
    await expect(runCard(page).getByTestId('run-status')).toHaveText('Queued')
    await runCard(page).getByRole('button', { name: 'Cancel' }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel run' }).click()
    await expect(runCard(page).getByTestId('run-status')).toHaveText('Cancelled')
    expect((await api.get(`/api/sims/runs/${queued.id}/`)).status).toBe('cancelled')

    // A playing run keeps its finished games.
    await openRun(page, playing.id)
    await expect(runCard(page).getByTestId('run-status')).toHaveText('Playing 1 / 2', { timeout: 30_000 })
    await runCard(page).getByRole('button', { name: 'Cancel' }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel run' }).click()
    await expect(runCard(page).getByTestId('run-status')).toHaveText('Cancelled', { timeout: 15_000 })
    expect((await api.get(`/api/sims/runs/${playing.id}/`)).results).toHaveLength(1)

    // Nobody else can cancel or delete; the runner deletes with a confirm and goes back to the list.
    const other = uniqueUser('q')
    await createUser(request, other)
    const login = await request.post('/api/auth/login/', { data: { login: other.username, password: other.password } })
    const headers = { Authorization: `Bearer ${(await login.json()).access}` }
    expect((await request.delete(`/api/sims/runs/${playing.id}/`, { headers })).status()).toBe(404)
    expect((await request.post(`/api/sims/runs/${playing.id}/cancel/`, { headers })).status()).toBe(404)
    await runCard(page).getByRole('button', { name: 'Delete' }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Run deleted.')).toBeVisible()
    await expect(page).toHaveURL(/\/simulations$/)
    const left = (await api.get(`/api/sims/runs/?mine=1&q=Hangs ${stamp}`)).results.map((r: { id: number }) => r.id)
    expect(left).toEqual([queued.id])
  })

  test('Spec 024 AC-15, AC-19 to AC-21: results and the lists used, on the run page', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Results ${stamp}`)
    const secret = await commanderDeck(api, `Secret ${stamp}`, PIPER)
    const run = await startRun(api, deck.id, [{ deck: secret.id }])
    await waitForRun(api, run.id)
    // AC-15: later changes don't touch the run's copy.
    await api.post(`/api/decks/${deck.id}/cards/`, { printing: (await api.get(`/api/decks/${secret.id}/`)).cards[0].printing.id, zone: 'main' })
    await openRun(page, run.id)
    await expect(page.getByTestId('sim-run-title')).toHaveText(`Results ${stamp}`)

    // AC-16, AC-19: who, status and the win rate (the recorded game: the second seat wins on its turn 12, recorded again for spec 026).
    const card = runCard(page)
    await expect(card.getByTestId('run-status')).toHaveText('Done')
    await expect(card).toContainText(user.username)
    await expect(card.getByTestId('run-win-rate')).toHaveText('Win rate 50%')
    await expect(card.getByTestId('run-summary')).toContainText('1 / 2')
    await expect(card.getByTestId('run-avg-turn')).toHaveText('12')
    // AC-20: a row per deck.
    await expect(card.getByTestId('pod-row')).toHaveText([
      new RegExp(`Results ${stamp}.*Krenko, Mob Boss.*Default\\s*1\\s*0\\s*12\\s*1`),
      new RegExp(`Secret ${stamp}.*The Prismatic Piper.*Default\\s*1\\s*0\\s*12\\s*1`),
    ])
    // AC-21: each game with its winner, turn and seat order.
    await expect(card.getByTestId('run-game')).toHaveText([
      new RegExp(`Game 1.*Secret ${stamp} won on turn 12.*Results ${stamp} → Secret ${stamp}.*Replay`),
      new RegExp(`Game 2.*Results ${stamp} won on turn 12.*Secret ${stamp} → Results ${stamp}.*Replay`),
    ])
    await card.getByTestId('pod-row').first().getByText(`Results ${stamp}`).click()
    await expect(card.getByTestId('pod-list').first()).toContainText('36 Forest')
    await expect(card.getByTestId('pod-list').first()).not.toContainText('Prismatic Piper')
  })

  test('Spec 024 AC-22: a game Forge fails doesn\'t count; draws count but aren\'t wins', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const broken = await commanderDeck(api, `Broken ${stamp}`)
    const stalls = await commanderDeck(api, `Stalls ${stamp}`)
    const piper = await commanderDeck(api, `Odd Piper ${stamp}`, PIPER)
    const failed = await startRun(api, broken.id, [{ deck: piper.id }])
    const drawn = await startRun(api, stalls.id, [{ deck: piper.id }])
    await waitForRun(api, failed.id)
    await waitForRun(api, drawn.id)

    await openRun(page, failed.id)
    const card = runCard(page)
    await expect(card.getByTestId('run-status')).toHaveText('Done')
    await expect(card.getByTestId('game-result')).toHaveText(['Failed', 'Failed'])
    await expect(card.getByTestId('run-game').first()).toContainText('Broken deck')
    await expect(card.getByTestId('run-win-rate')).toHaveCount(0)

    await openRun(page, drawn.id)
    await expect(card.getByTestId('run-win-rate')).toHaveText('Win rate 0%')
    await expect(card.getByTestId('game-result').first()).toHaveText(/Draw on game turn \d+/)
    await expect(card.getByTestId('pod-row').first()).toContainText(/Default\s*0\s*2/)
  })
})
