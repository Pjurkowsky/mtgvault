import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { OTHER_FORGE_KEY, OTHER_FORGE_PORT } from '../playwright.config'
import { apiAs, createUser, signUpAndLogIn, uniqueUser } from './helpers'
import { PIPER, commanderDeck, dropEmptySeats, makeStaff, openRun, openSimulations, pickDeck, runCard, startRun, waitForRun, type Api } from './sim-helpers'

// Spec 029, AC-7 to AC-12, with spec 031's names (AC-1): Main and Other Forge. The settings are
// server-wide, so this file has its own project after the rest (playwright.config.ts) and puts them back.
// Main is the e2e fake Forge ("fake", no key); Other points at a second one ("fake-other", key "secret").
const MAIN = `http://127.0.0.1:${Number(process.env.E2E_FORGE_PORT ?? 8190)}`
const OTHER = `http://127.0.0.1:${OTHER_FORGE_PORT}`
const NOWHERE = 'http://127.0.0.1:9'
type Server = { url: string; key: string; slots: number }

async function staffApi(request: APIRequestContext) {
  const user = uniqueUser('staff')
  await createUser(request, user)
  makeStaff(user.username)
  return apiAs(request, user)
}
/** Set Other (and Main, which defaults to the e2e Forge). */
const put = (api: Api, other: Partial<Server>, main: Partial<Server> = {}) =>
  api.put('/api/sims/forge/', { other: { url: '', key: '', slots: 1, ...other }, main: { url: MAIN, key: '', slots: 1, ...main } })

/** The run's games as [server, version]. */
const played = async (api: Api, id: number) =>
  (await api.get(`/api/sims/runs/${id}/`)).results.map((g: { forge_server: string; forge_version: string }) => [g.forge_server, g.forge_version])

const card = (page: Page) => page.getByTestId('forge-servers')

test.describe('Main and Other Forge', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  let admin: Api

  test.beforeEach(async ({ request }) => {
    admin = await staffApi(request)
  })
  test.afterEach(async () => {
    await fetch(`${OTHER}/_down`, { method: 'POST', body: JSON.stringify({ seconds: 0 }) })
    await put(admin, {})
  })

  test('AC-7, AC-8 (spec 031, AC-1): staff set Main and Other in Settings and test them; others can\'t', async ({ page, request }) => {
    // Not staff: no card, and the API refuses.
    const { user } = await signUpAndLogIn(page, request)
    await page.goto('/settings')
    await expect(page.getByTestId('scanner-source')).toHaveCount(0)
    await expect(card(page)).toHaveCount(0)
    const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
    const headers = { Authorization: `Bearer ${(await login.json()).access}` }
    expect((await request.get('/api/sims/forge/', { headers })).status()).toBe(403)
    expect((await request.post('/api/sims/forge/test/', { headers, data: { url: MAIN } })).status()).toBe(403)

    makeStaff(user.username)
    await page.reload()
    const other = card(page).getByTestId('forge-other')
    const main = card(page).getByTestId('forge-main')
    // Main starts as the server's FORGE_URL.
    await expect(main.getByLabel('Address')).toHaveValue(MAIN)
    await expect(other.getByLabel('Address')).toHaveValue('')
    await expect(page.locator('#forge-other-slots')).toHaveValue('1')

    // AC-8: Test what is typed: unreachable, wrong key, then right.
    await other.getByLabel('Address').fill(NOWHERE)
    await other.getByRole('button', { name: 'Test' }).click()
    await expect(other.getByTestId('forge-test-error')).toContainText('not reachable')
    await other.getByLabel('Address').fill(OTHER)
    await page.locator('#forge-other-key').fill('wrong')
    await other.getByRole('button', { name: 'Test' }).click()
    await expect(other.getByTestId('forge-test-error')).toHaveText('Wrong Forge key.')
    await page.locator('#forge-other-key').fill(OTHER_FORGE_KEY)
    await other.getByRole('button', { name: 'Test' }).click()
    await expect(other.getByTestId('forge-test-ok')).toHaveText('Forge fake-other')
    await expect(other.getByTestId('forge-test-error')).toHaveCount(0)
    await main.getByRole('button', { name: 'Test' }).click()
    await expect(main.getByTestId('forge-test-ok')).toHaveText('Forge fake')

    // Games at once is 1 to 8.
    await page.locator('#forge-other-slots').fill('9')
    await card(page).getByRole('button', { name: 'Save' }).click()
    await expect(other.getByText('Ensure this value is less than or equal to 8.')).toBeVisible()
    await page.locator('#forge-other-slots').fill('2')
    await card(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Forge settings saved.')).toBeVisible()
    await page.reload()
    await expect(card(page).getByTestId('forge-other').getByLabel('Address')).toHaveValue(OTHER)
    await expect(page.locator('#forge-other-slots')).toHaveValue('2')
    const saved = await admin.get('/api/sims/forge/')
    expect(saved.other).toEqual({ url: OTHER, key: OTHER_FORGE_KEY, slots: 2 })
  })

  test('AC-10 (spec 031, AC-3): Auto games go to Other while it answers, otherwise to Main; Simulations stays available', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Routed ${stamp}`)
    const piper = await commanderDeck(api, `Routed Piper ${stamp}`, PIPER)

    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })
    expect(await api.get('/api/sims/status/')).toEqual({ available: true, version: 'fake-other' })
    const onOther = await startRun(api, deck.id, [{ deck: piper.id }])
    await waitForRun(api, onOther.id)
    expect(await played(api, onOther.id)).toEqual([['other', 'fake-other'], ['other', 'fake-other']])

    // Other doesn't answer (here: a wrong key) → Main.
    await put(admin, { url: OTHER, key: 'wrong' })
    expect(await api.get('/api/sims/status/')).toEqual({ available: true, version: 'fake' })
    const onMain = await startRun(api, deck.id, [{ deck: piper.id }])
    await waitForRun(api, onMain.id)
    expect(await played(api, onMain.id)).toEqual([['main', 'fake'], ['main', 'fake']])

    // Neither answers: Simulations is unavailable.
    await put(admin, { url: NOWHERE }, { url: NOWHERE })
    expect((await api.get('/api/sims/status/')).available).toBe(false)
  })

  test('AC-11: a Forge plays up to its Games at once; a free slot takes the next run\'s game', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    // "Hangs" games take 8 seconds.
    const hangs = await commanderDeck(api, `Hangs slots ${stamp}`)
    const piper = await commanderDeck(api, `Slots Piper ${stamp}`, PIPER)

    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY, slots: 3 })
    const first = await startRun(api, hangs.id, [{ deck: piper.id }])
    const second = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1 })
    // Both of the first run's games and the second run's game play at the same time.
    await expect.poll(async () => [(await api.get(`/api/sims/runs/${first.id}/`)).status, (await api.get(`/api/sims/runs/${second.id}/`)).status],
      { timeout: 5_000 }).toEqual(['playing', 'playing'])
    const started = Date.now()
    await waitForRun(api, first.id)
    await waitForRun(api, second.id)
    expect(Date.now() - started).toBeLessThan(14_000) // one at a time would take 24 seconds
    expect(await played(api, first.id)).toEqual([['other', 'fake-other'], ['other', 'fake-other']])
  })

  test('AC-12 (spec 031, AC-3): an Auto game whose Forge stops answering plays again on the other one', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    const hangs = await commanderDeck(api, `Hangs down ${stamp}`)
    const piper = await commanderDeck(api, `Down Piper ${stamp}`, PIPER)

    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })
    const run = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1 })
    await expect.poll(async () => (await api.get(`/api/sims/runs/${run.id}/`)).status, { timeout: 5_000 }).toBe('playing')
    // Other stops answering for 4 seconds, in the middle of the game.
    await fetch(`${OTHER}/_down`, { method: 'POST', body: JSON.stringify({ seconds: 4 }) })
    const done = await waitForRun(api, run.id)
    expect(done.error).toBe('')
    expect(await played(api, run.id)).toEqual([['main', 'fake']])
    expect(done.results[0].status).not.toBe('failed')
  })

  test('AC-2, AC-5 (spec 031): the run form picks Auto, Main or Other, remembered; the run shows it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    await commanderDeck(api, `Chooses ${stamp}`)
    await commanderDeck(api, `Chooses Piper ${stamp}`, PIPER)
    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })

    await openSimulations(page)
    const choice = page.getByTestId('sim-forge')
    await expect(choice.getByRole('button')).toHaveText(['Auto', 'Main', 'Other'])
    await expect(choice.getByRole('button', { pressed: true })).toHaveText('Auto')
    await choice.getByRole('button', { name: 'Main' }).click()
    await pickDeck(page, 1, 'My decks', `Chooses ${stamp}`)
    await pickDeck(page, 2, 'My decks', `Chooses Piper ${stamp}`)
    await dropEmptySeats(page)
    await page.getByLabel('Games').fill('1')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()
    const run = (await api.get(`/api/sims/runs/?q=Chooses ${stamp}`)).results[0]
    const done = await waitForRun(api, run.id)
    expect(done.forge).toBe('main')
    // Other answers, but the run asked for Main.
    expect(await played(api, run.id)).toEqual([['main', 'fake']])
    await openRun(page, run.id)
    await runCard(page).getByTestId('run-forge').getByRole('button').hover()
    await expect(page.getByRole('tooltip')).toHaveText('Forge fake · Look-ahead Normal · Main')
    // Remembered in this browser.
    await openSimulations(page)
    await expect(page.getByTestId('sim-forge').getByRole('button', { pressed: true })).toHaveText('Main')
  })

  test('AC-3, AC-4 (spec 031): Other plays only on Other; when it does not answer the run fails', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Chosen ${stamp}`)
    const hangs = await commanderDeck(api, `Hangs chosen ${stamp}`)
    const piper = await commanderDeck(api, `Chosen Piper ${stamp}`, PIPER)

    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })
    const onOther = await startRun(api, deck.id, [{ deck: piper.id }], { forge: 'other' })
    await waitForRun(api, onOther.id)
    expect(await played(api, onOther.id)).toEqual([['other', 'fake-other'], ['other', 'fake-other']])

    // At the start: Other refuses the key.
    await put(admin, { url: OTHER, key: 'wrong' })
    const refused = await startRun(api, deck.id, [{ deck: piper.id }], { forge: 'other' })
    const failed = await waitForRun(api, refused.id, 'failed')
    expect(failed.error).toBe('Other (127.0.0.1:8192) is not answering.')
    expect(failed.results).toEqual([])
    // Auto still plays, on Main.
    const auto = await startRun(api, deck.id, [{ deck: piper.id }], { games: 1 })
    await waitForRun(api, auto.id)
    expect(await played(api, auto.id)).toEqual([['main', 'fake']])

    // In the middle of a game: Other stops answering.
    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })
    const stopped = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1, forge: 'other' })
    await expect.poll(async () => (await api.get(`/api/sims/runs/${stopped.id}/`)).status, { timeout: 5_000 }).toBe('playing')
    await fetch(`${OTHER}/_down`, { method: 'POST', body: JSON.stringify({ seconds: 4 }) })
    const midway = await waitForRun(api, stopped.id, 'failed')
    expect(midway.error).toBe('Other (127.0.0.1:8192) is not answering.')
  })

  test('AC-6 (spec 031): Restart plays what is left of a cancelled or failed run, on the Forge picked again', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const hangs = await commanderDeck(api, `Hangs restart ${stamp}`)
    const piper = await commanderDeck(api, `Restart Piper ${stamp}`, PIPER)

    await put(admin, { url: OTHER, key: OTHER_FORGE_KEY })
    // Cancelled after its first game.
    const run = await startRun(api, hangs.id, [{ deck: piper.id }], { forge: 'other' })
    await expect.poll(async () => (await api.get(`/api/sims/runs/${run.id}/`)).played, { timeout: 30_000 }).toBe(1)
    await api.post(`/api/sims/runs/${run.id}/cancel/`)
    const cancelled = await waitForRun(api, run.id, 'cancelled')
    expect(cancelled.played).toBe(1)
    expect(cancelled.can_restart).toBe(true)

    await openRun(page, run.id)
    await runCard(page).getByRole('button', { name: 'Restart' }).click()
    const dialog = page.getByTestId('restart-dialog')
    await expect(dialog.getByRole('button', { pressed: true })).toHaveText('Other')
    await dialog.getByRole('button', { name: 'Main' }).click()
    await dialog.getByRole('button', { name: 'Restart' }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()
    const done = await waitForRun(api, run.id)
    // The finished game stays; the rest played on Main. The time counts from the first start.
    expect(await played(api, run.id)).toEqual([['other', 'fake-other'], ['main', 'fake']])
    expect(done.started_at).toBe(cancelled.started_at)
    expect(done.forge).toBe('main')
    await expect(runCard(page).getByRole('button', { name: 'Restart' })).toHaveCount(0)

    // A failed run restarts too.
    await put(admin, { url: OTHER, key: 'wrong' })
    const refused = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1, forge: 'other' })
    await waitForRun(api, refused.id, 'failed')
    await api.post(`/api/sims/runs/${refused.id}/restart/`, { forge: 'auto' })
    await waitForRun(api, refused.id)
    expect(await played(api, refused.id)).toEqual([['main', 'fake']])
  })
})
