import { expect, test } from '@playwright/test'
import { apiAs, createUser, logIn, logOut, signUpAndLogIn, uniqueUser } from './helpers'
import { PIPER, commanderDeck, makeStaff, openRun, openSimulations, runCard, startRun, waitForRun } from './sim-helpers'

// Spec 025, AC-13 to AC-15: admins cancel any run, or all of them. Its own project runs it after the
// rest of the suite (playwright.config.ts), since Cancel all stops every run on the server.
const entry = (page: import('@playwright/test').Page, text: string) => page.getByTestId('queue-entry').filter({ hasText: text })

test.describe('Admin cancel', () => {
  test.describe.configure({ timeout: 120_000, mode: 'serial' })

  test('AC-13, AC-15: admins cancel anyone\'s run from the queue or its page; the runner sees who; only the runner deletes', async ({ page, request }) => {
    const runner = uniqueUser('u')
    await createUser(request, runner)
    const runnerApi = await apiAs(request, runner)
    const stamp = Date.now()
    const hangs = await commanderDeck(runnerApi, `Hangs admin ${stamp}`, undefined, { is_public: true })
    const piper = await commanderDeck(runnerApi, `Admin Piper ${stamp}`, PIPER, { is_public: true })
    const playing = await startRun(runnerApi, hangs.id, [{ deck: piper.id }])
    const queued = await startRun(runnerApi, piper.id, [{ deck: hangs.id }])

    // A user who isn't an admin can't cancel someone else's run.
    const { user } = await signUpAndLogIn(page, request)
    await openSimulations(page)
    await expect(entry(page, `Admin Piper ${stamp}`)).toBeVisible()
    await expect(entry(page, `Admin Piper ${stamp}`).getByRole('button', { name: 'Cancel run' })).toHaveCount(0)
    await expect(page.getByTestId('queue-cancel-all')).toHaveCount(0)

    makeStaff(user.username)
    await page.reload()
    // From the queue, with a confirm.
    await entry(page, `Admin Piper ${stamp}`).getByRole('button', { name: 'Cancel run' }).click()
    await expect(page.getByTestId('confirm-dialog')).toContainText(`Cancel ${runner.username}'s run?`)
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel run' }).click()
    await expect(entry(page, `Admin Piper ${stamp}`)).toHaveCount(0)
    // From the run page.
    await openRun(page, playing.id)
    await runCard(page).getByRole('button', { name: 'Cancel' }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel run' }).click()
    await expect(runCard(page).getByTestId('run-status')).toHaveText(/Cancel/)
    await expect(runCard(page).getByRole('button', { name: 'Delete' })).toHaveCount(0, { timeout: 30_000 })
    await waitForRun(runnerApi, playing.id, 'cancelled', 30_000)

    // AC-15: everyone who sees the run reads who cancelled it.
    await logOut(page)
    await logIn(page, runner.username, runner.password)
    await expect(page.getByTestId('user-menu')).toHaveText(runner.username)
    await openRun(page, queued.id)
    await expect(runCard(page).getByTestId('run-status')).toHaveText(`Cancelled by ${user.username}`)
    await openSimulations(page, `?q=${stamp}`)
    await expect(page.getByTestId('sim-run-row').filter({ hasText: `Hangs admin ${stamp}` }).getByTestId('run-row-status')).toHaveText(`Cancelled by ${user.username}`)
    // Only the runner deletes.
    await openRun(page, queued.id)
    await expect(runCard(page).getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('AC-14: Cancel all stops the playing run, keeping its games, and cancels every queued one', async ({ page, request }) => {
    const runner = uniqueUser('u')
    await createUser(request, runner)
    const runnerApi = await apiAs(request, runner)
    const stamp = Date.now()
    const hangs = await commanderDeck(runnerApi, `Hangs all ${stamp}`)
    const piper = await commanderDeck(runnerApi, `All Piper ${stamp}`, PIPER)
    const playing = await startRun(runnerApi, hangs.id, [{ deck: piper.id }], { games: 3 })
    const queued = [await startRun(runnerApi, piper.id, [{ deck: hangs.id }]), await startRun(runnerApi, hangs.id, [{ deck: piper.id }])]
    await waitForRun(runnerApi, playing.id, 'playing')
    await expect.poll(async () => (await runnerApi.get(`/api/sims/runs/${playing.id}/`)).played, { timeout: 30_000 }).toBe(1)

    const { user } = await signUpAndLogIn(page, request)
    makeStaff(user.username)
    await openSimulations(page)
    // AC-12: an admin sees private deck names in the queue.
    await expect(entry(page, `Hangs all ${stamp}`)).toHaveCount(2)
    await page.getByTestId('queue-cancel-all').click()
    await expect(page.getByTestId('confirm-dialog')).toContainText('every queued run is cancelled')
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Cancel all' }).click()
    await expect(page.getByText(/Cancelled \d+ runs?\./)).toBeVisible()
    await expect(page.getByTestId('sim-queue')).toHaveCount(0, { timeout: 30_000 })

    const stopped = await waitForRun(runnerApi, playing.id, 'cancelled', 30_000)
    expect(stopped.results.length).toBeGreaterThanOrEqual(1) // its finished games stay
    expect(stopped.results.length).toBeLessThan(3)
    expect(stopped.cancelled_by).toBe(user.username)
    for (const run of queued) expect((await runnerApi.get(`/api/sims/runs/${run.id}/`)).status).toBe('cancelled')
  })
})
