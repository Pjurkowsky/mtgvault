import { expect, test } from '@playwright/test'
import { apiAs, createUser, logIn, logOut, signUpAndLogIn, uniqueUser } from './helpers'
import { PIPER, commanderDeck, makeStaff, openSimulations, rows, startRun, waitForRun } from './sim-helpers'

// Spec 025: the Simulations page in the top bar.
const queueEntry = (page: import('@playwright/test').Page, text: string) => page.getByTestId('queue-entry').filter({ hasText: text })

test.describe('Simulations page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('AC-1, AC-2: Simulations in the top bar for logged-in users with Forge; no Simulate tab on decks', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await commanderDeck(api, `Top bar ${Date.now()}`, undefined, { is_public: true })

    await page.getByRole('link', { name: 'Simulations' }).click()
    await expect(page).toHaveURL(/\/simulations$/)
    await expect(page.getByTestId('sim-form')).toBeVisible()

    // AC-2: a Commander deck has no Simulate tab, and ?tab=simulate opens the Deck tab.
    await page.goto(`/decks/${deck.id}?tab=simulate`)
    await expect(page.getByRole('tab')).toHaveText(['Deck', 'Swaps', 'Combos', 'Stats'])
    await expect(page.getByRole('tab', { name: 'Deck' })).toHaveAttribute('data-state', 'active')

    // Without a Forge service the item is hidden.
    await page.route('**/api/sims/status/', (route) => route.fulfill({ json: { available: false, version: '' } }))
    await page.reload()
    await expect(page.getByRole('tab', { name: 'Stats' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Simulations' })).toHaveCount(0)
    await page.unroute('**/api/sims/status/')

    // Visitors don't see it; the page sends them to log in.
    await logOut(page)
    await page.goto('/users')
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Simulations' })).toHaveCount(0)
    await page.goto('/simulations')
    await expect(page).toHaveURL(/\/login/)
    expect((await request.get('/api/sims/runs/')).status()).toBe(401)
  })

  test('AC-6 to AC-8: runs newest first, All / Mine, search any deck in the pod, Show more, a row opens the run', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const krenko = await commanderDeck(api, `List Krenko ${stamp}`, undefined, { is_public: true })
    const piper = await commanderDeck(api, `List Piper ${stamp}`, PIPER)
    // 21 runs, cancelled at once: enough for Show more without playing them.
    const ids: number[] = []
    for (let i = 0; i < 21; i++) {
      const run = await startRun(api, krenko.id, [{ deck: piper.id }], { games: 1 })
      await api.post(`/api/sims/runs/${run.id}/cancel/`, {})
      ids.push(run.id)
    }
    const done = await startRun(api, krenko.id, [{ deck: piper.id }])
    await waitForRun(api, done.id)
    // Another user's run on their public deck, with my Krenko list as a pool opponent.
    const other = uniqueUser('l')
    await createUser(request, other)
    const otherApi = await apiAs(request, other)
    const theirs = await commanderDeck(otherApi, `Their deck ${stamp}`, PIPER, { is_public: true })
    const { id: poolId } = await otherApi.post('/api/sims/pool/', { deck: krenko.id })
    await otherApi.patch(`/api/sims/pool/${poolId}/`, { name: `Pooled Krenko ${stamp}` })
    const theirRun = await startRun(otherApi, theirs.id, [{ pool: poolId }], { games: 1 })
    await otherApi.post(`/api/sims/runs/${theirRun.id}/cancel/`, {})

    // AC-7: the search matches any deck in the pod, by name or commander.
    await openSimulations(page)
    await page.getByLabel('Search runs').fill(String(stamp))
    await expect(page).toHaveURL(new RegExp(`q=${stamp}`))
    await expect(page.getByTestId('sim-runs-total')).toHaveText('23')
    // AC-6: 20 at a time, newest first.
    await expect(rows(page)).toHaveCount(20)
    await expect(rows(page).first().getByTestId('run-row-deck')).toHaveText(`Their deck ${stamp}`)
    await expect(rows(page).first().getByTestId('run-row-opponents')).toHaveText('vs Krenko, Mob Boss')
    await expect(rows(page).first()).toContainText(other.username)
    await expect(rows(page).first().getByTestId('run-row-status')).toHaveText('Cancelled')
    await expect(rows(page).nth(1).getByTestId('run-row-deck')).toHaveText(`List Krenko ${stamp}`)
    await expect(rows(page).nth(1).getByTestId('run-row-opponents')).toHaveText('vs The Prismatic Piper')
    await expect(rows(page).nth(1).getByTestId('run-row-status')).toHaveText('Done')
    await expect(rows(page).nth(1).getByTestId('run-row-win-rate')).toHaveText('50%')
    await expect(rows(page).nth(1).locator('img')).toHaveAttribute('src', /art_crop/)
    await page.getByTestId('sim-runs-more').click()
    await expect(rows(page)).toHaveCount(23)
    await expect(page.getByTestId('sim-runs-more')).toHaveCount(0)

    await page.getByLabel('Search runs').fill(`Pooled Krenko ${stamp}`)
    await expect(rows(page)).toHaveCount(1)
    await page.getByLabel('Search runs').fill(`List Piper ${stamp}`)
    await expect(page.getByTestId('sim-runs-total')).toHaveText('22')

    // Mine: only my own runs.
    await page.getByLabel('Search runs').fill(String(stamp))
    await page.getByRole('button', { name: 'Mine', exact: true }).click()
    await expect(page).toHaveURL(/mine=1/)
    await expect(page.getByTestId('sim-runs-total')).toHaveText('22')
    await expect(rows(page).filter({ hasText: other.username })).toHaveCount(0)
    await expect(rows(page).first()).toContainText(user.username)

    // AC-8: a row opens the run's page; Back keeps the filters.
    await rows(page).first().click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${done.id}$`))
    await expect(page.getByTestId('sim-run')).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Mine', exact: true })).toHaveAttribute('data-state', 'on')
    await expect(page.getByLabel('Search runs')).toHaveValue(String(stamp))
    expect(ids).toHaveLength(21)
  })

  test('AC-10 to AC-12: private decks\' runs stay with their owner, the queue hides their names, admins see all', async ({ page, request }) => {
    const owner = uniqueUser('o')
    await createUser(request, owner)
    const ownerApi = await apiAs(request, owner)
    const stamp = Date.now()
    const secret = await commanderDeck(ownerApi, `Hangs secret ${stamp}`)
    const open = await commanderDeck(ownerApi, `Open ${stamp}`, PIPER, { is_public: true })
    const { id: poolId } = await ownerApi.post('/api/sims/pool/', { name: `Pool tested ${stamp}`, text: PIPER })
    const privateRun = await startRun(ownerApi, secret.id, [{ deck: open.id }])
    const poolRun = await startRun(ownerApi, { pool: poolId }, [{ deck: open.id }], { games: 1 })

    const { user, api } = await signUpAndLogIn(page, request)
    await openSimulations(page)
    // AC-11: the private run is in the queue without its name and doesn't open.
    const hidden = queueEntry(page, owner.username).filter({ hasText: 'Private deck' })
    await expect(hidden).toHaveCount(1)
    await expect(hidden.getByRole('link')).toHaveCount(0)
    await expect(page.getByTestId('queue-entry').filter({ hasText: `Hangs secret ${stamp}` })).toHaveCount(0)
    // AC-10: not in the list, not reachable.
    await page.getByLabel('Search runs').fill(String(stamp))
    await expect(rows(page)).toHaveText([new RegExp(`Pool tested ${stamp}`)])
    const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
    const headers = { Authorization: `Bearer ${(await login.json()).access}` }
    expect((await request.get(`/api/sims/runs/${privateRun.id}/`, { headers })).status()).toBe(404)

    // A pool deck's run is visible to everyone and stays when the pool deck goes.
    await waitForRun(api, poolRun.id)
    await api.delete(`/api/sims/pool/${poolId}/`)
    await page.reload()
    await expect(rows(page)).toHaveText([new RegExp(`Pool tested ${stamp}`)])
    await rows(page).first().click()
    await expect(page.getByTestId('sim-run-title')).toHaveText(`Pool tested ${stamp}`)

    // Visibility follows the deck as it is now.
    await ownerApi.patch(`/api/decks/${secret.id}/`, { is_public: true })
    await openSimulations(page, `?q=${stamp}`)
    await expect(rows(page)).toHaveCount(2)
    await ownerApi.patch(`/api/decks/${secret.id}/`, { is_public: false })

    // AC-12: an admin sees the name, the run and its replays.
    const admin = uniqueUser('a')
    await createUser(request, admin)
    makeStaff(admin.username)
    await logOut(page)
    await logIn(page, admin.username, admin.password)
    await expect(page.getByTestId('user-menu')).toHaveText(admin.username)
    await openSimulations(page, `?q=${stamp}`)
    await expect(rows(page)).toHaveCount(2)
    await waitForRun(ownerApi, privateRun.id, 'done', 90_000)
    await rows(page).filter({ hasText: `Hangs secret ${stamp}` }).click()
    await expect(page.getByTestId('sim-run-title')).toHaveText(`Hangs secret ${stamp}`)
    await page.getByTestId('sim-run').getByRole('link', { name: 'Replay' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${privateRun.id}/games/1$`))
    await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible()
  })
})
