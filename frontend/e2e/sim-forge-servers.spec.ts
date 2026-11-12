import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { MAIN_FORGE_KEY, MAIN_FORGE_PORT } from '../playwright.config'
import { apiAs, createUser, signUpAndLogIn, uniqueUser } from './helpers'
import { PIPER, commanderDeck, makeStaff, startRun, waitForRun, type Api } from './sim-helpers'

// Spec 029, AC-7 to AC-12: Main and Fallback Forge. The settings are server-wide, so this file has
// its own project after the rest (playwright.config.ts) and puts them back when done.
// Fallback is the e2e fake Forge ("fake", no key); Main points at a second one ("fake-main", key "secret").
const FALLBACK = `http://127.0.0.1:${Number(process.env.E2E_FORGE_PORT ?? 8190)}`
const MAIN = `http://127.0.0.1:${MAIN_FORGE_PORT}`
const NOWHERE = 'http://127.0.0.1:9'
type Server = { url: string; key: string; slots: number }

async function staffApi(request: APIRequestContext) {
  const user = uniqueUser('staff')
  await createUser(request, user)
  makeStaff(user.username)
  return apiAs(request, user)
}
const put = (api: Api, main: Partial<Server>, fallback: Partial<Server> = {}) =>
  api.put('/api/sims/forge/', { main: { url: '', key: '', slots: 1, ...main }, fallback: { url: FALLBACK, key: '', slots: 1, ...fallback } })

/** The run's games as [server, version]. */
const played = async (api: Api, id: number) =>
  (await api.get(`/api/sims/runs/${id}/`)).results.map((g: { forge_server: string; forge_version: string }) => [g.forge_server, g.forge_version])

const card = (page: Page) => page.getByTestId('forge-servers')

test.describe('Main and Fallback Forge', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  let admin: Api

  test.beforeEach(async ({ request }) => {
    admin = await staffApi(request)
  })
  test.afterEach(async () => {
    await fetch(`${MAIN}/_down`, { method: 'POST', body: JSON.stringify({ seconds: 0 }) })
    await put(admin, {})
  })

  test('AC-7, AC-8: staff set Main and Fallback in Settings and test them; others can\'t', async ({ page, request }) => {
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
    const main = card(page).getByTestId('forge-main')
    const fallback = card(page).getByTestId('forge-fallback')
    // Fallback starts as the server's FORGE_URL.
    await expect(fallback.getByLabel('Address')).toHaveValue(FALLBACK)
    await expect(main.getByLabel('Address')).toHaveValue('')
    await expect(page.locator('#forge-main-slots')).toHaveValue('1')

    // AC-8: Test what is typed: unreachable, wrong key, then right.
    await main.getByLabel('Address').fill(NOWHERE)
    await main.getByRole('button', { name: 'Test' }).click()
    await expect(main.getByTestId('forge-test-error')).toContainText('not reachable')
    await main.getByLabel('Address').fill(MAIN)
    await page.locator('#forge-main-key').fill('wrong')
    await main.getByRole('button', { name: 'Test' }).click()
    await expect(main.getByTestId('forge-test-error')).toHaveText('Wrong Forge key.')
    await page.locator('#forge-main-key').fill(MAIN_FORGE_KEY)
    await main.getByRole('button', { name: 'Test' }).click()
    await expect(main.getByTestId('forge-test-ok')).toHaveText('Forge fake-main')
    await expect(main.getByTestId('forge-test-error')).toHaveCount(0)
    await fallback.getByRole('button', { name: 'Test' }).click()
    await expect(fallback.getByTestId('forge-test-ok')).toHaveText('Forge fake')

    // Games at once is 1 to 8.
    await page.locator('#forge-main-slots').fill('9')
    await card(page).getByRole('button', { name: 'Save' }).click()
    await expect(main.getByText('Ensure this value is less than or equal to 8.')).toBeVisible()
    await page.locator('#forge-main-slots').fill('2')
    await card(page).getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Forge settings saved.')).toBeVisible()
    await page.reload()
    await expect(card(page).getByTestId('forge-main').getByLabel('Address')).toHaveValue(MAIN)
    await expect(page.locator('#forge-main-slots')).toHaveValue('2')
    const saved = await admin.get('/api/sims/forge/')
    expect(saved.main).toEqual({ url: MAIN, key: MAIN_FORGE_KEY, slots: 2 })
  })

  test('AC-10: new games go to Main while it answers, otherwise to Fallback; Simulations stays available', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Routed ${stamp}`)
    const piper = await commanderDeck(api, `Routed Piper ${stamp}`, PIPER)

    await put(admin, { url: MAIN, key: MAIN_FORGE_KEY })
    expect(await api.get('/api/sims/status/')).toEqual({ available: true, version: 'fake-main' })
    const onMain = await startRun(api, deck.id, [{ deck: piper.id }])
    await waitForRun(api, onMain.id)
    expect(await played(api, onMain.id)).toEqual([['main', 'fake-main'], ['main', 'fake-main']])

    // Main doesn't answer (here: a wrong key) → Fallback.
    await put(admin, { url: MAIN, key: 'wrong' })
    expect(await api.get('/api/sims/status/')).toEqual({ available: true, version: 'fake' })
    const onFallback = await startRun(api, deck.id, [{ deck: piper.id }])
    await waitForRun(api, onFallback.id)
    expect(await played(api, onFallback.id)).toEqual([['fallback', 'fake'], ['fallback', 'fake']])

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

    await put(admin, { url: MAIN, key: MAIN_FORGE_KEY, slots: 3 })
    const first = await startRun(api, hangs.id, [{ deck: piper.id }])
    const second = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1 })
    // Both of the first run's games and the second run's game play at the same time.
    await expect.poll(async () => [(await api.get(`/api/sims/runs/${first.id}/`)).status, (await api.get(`/api/sims/runs/${second.id}/`)).status],
      { timeout: 5_000 }).toEqual(['playing', 'playing'])
    const started = Date.now()
    await waitForRun(api, first.id)
    await waitForRun(api, second.id)
    expect(Date.now() - started).toBeLessThan(14_000) // one at a time would take 24 seconds
    expect(await played(api, first.id)).toEqual([['main', 'fake-main'], ['main', 'fake-main']])
  })

  test('AC-12: a game whose Forge stops answering plays again on the other one', async ({ request }) => {
    const user = uniqueUser('u')
    await createUser(request, user)
    const api = await apiAs(request, user)
    const stamp = Date.now()
    const hangs = await commanderDeck(api, `Hangs down ${stamp}`)
    const piper = await commanderDeck(api, `Down Piper ${stamp}`, PIPER)

    await put(admin, { url: MAIN, key: MAIN_FORGE_KEY })
    const run = await startRun(api, hangs.id, [{ deck: piper.id }], { games: 1 })
    await expect.poll(async () => (await api.get(`/api/sims/runs/${run.id}/`)).status, { timeout: 5_000 }).toBe('playing')
    // Main stops answering for 4 seconds, in the middle of the game.
    await fetch(`${MAIN}/_down`, { method: 'POST', body: JSON.stringify({ seconds: 4 }) })
    const done = await waitForRun(api, run.id)
    expect(done.error).toBe('')
    expect(await played(api, run.id)).toEqual([['fallback', 'fake']])
    expect(done.results[0].status).not.toBe('failed')
  })
})
