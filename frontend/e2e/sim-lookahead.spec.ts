import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, dropEmptySeats, openRun, openSimulations, pickDeck, runCard, seats, startRun, waitForRun } from './sim-helpers'

// Spec 029, AC-2 to AC-6: Forge 2.0.16's profiles and look-ahead, and which Forge played a run.
// Main is empty while this project runs (sim-forge-servers runs after it), so games go to the
// e2e Main (spec 031: this server's Forge): the fake Forge, version "fake".

/** Hover `target` and read its tooltip, then move away until it closes. */
async function tooltip(page: Page, target: import('@playwright/test').Locator) {
  await target.hover()
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const text = (await tip.textContent())?.trim()
  await page.mouse.move(0, 0)
  await expect(tip).toHaveCount(0)
  return text
}

/** A run as it was before spec 029, straight in the e2e database. */
function asBefore029(runId: number) {
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c',
    `from sims.models import SimGame, SimRun; SimRun.objects.filter(pk=${runId}).update(lookahead='off'); `
    + `SimGame.objects.filter(run_id=${runId}).update(forge_version='2.0.15', forge_server='')`], {
    cwd: new URL('../../backend/', import.meta.url).pathname, env: { ...process.env, DATABASE_URL },
  })
}

test.describe('Look-ahead and Forge 2.0.16 profiles', () => {
  test('AC-2 to AC-4: Hard and Hardest profiles; Look-ahead starts Normal and is remembered; 10 minutes', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    await commanderDeck(api, `Looks ${stamp}`)
    await commanderDeck(api, `Looks Piper ${stamp}`, PIPER)

    await openSimulations(page)
    // AC-4: 10 minutes to start; AC-3: Normal.
    await expect(page.getByLabel('Time limit (min)')).toHaveValue('10')
    const look = page.getByRole('combobox', { name: 'Look-ahead' })
    await expect(look).toHaveText('Normal')
    await look.click()
    await expect(page.getByRole('option')).toHaveText(['Off', 'Light', 'Normal', 'Maximum'])
    await page.getByRole('option', { name: 'Maximum' }).click()

    await pickDeck(page, 1, 'My decks', `Looks ${stamp}`)
    await pickDeck(page, 2, 'My decks', `Looks Piper ${stamp}`)
    await dropEmptySeats(page)
    // AC-2
    await seats(page).nth(1).getByRole('combobox', { name: 'AI profile, seat 2' }).click()
    await expect(page.getByRole('option')).toHaveText(['Default', 'Cautious', 'Reckless', 'Experimental', 'Hard', 'Hardest'])
    await page.getByRole('option', { name: 'Hardest' }).click()
    await page.getByLabel('Games').fill('1')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Run queued.')).toBeVisible()

    const run = (await api.get(`/api/sims/runs/?q=Looks ${stamp}`)).results[0]
    const full = await api.get(`/api/sims/runs/${run.id}/`)
    expect(full.lookahead).toBe('max')
    expect(full.minutes).toBe(10)
    expect(full.seats.map((s: { profile: string }) => s.profile)).toEqual(['Default', 'Hardest'])

    // Remembered in this browser.
    await openSimulations(page)
    await expect(page.getByRole('combobox', { name: 'Look-ahead' })).toHaveText('Maximum')

    // The API's defaults: Normal and 10 minutes.
    const piper = await commanderDeck(api, `Looks API ${stamp}`, PIPER)
    const plain = await api.post('/api/sims/runs/', { seats: [{ deck: piper.id }, { deck: piper.id }] })
    expect([plain.lookahead, plain.minutes]).toEqual(['normal', 10])
    await api.post(`/api/sims/runs/${plain.id}/cancel/`)
  })

  test('AC-5, AC-6: the run shows its Forge and look-ahead; each game shows the Forge that played it', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    // "Hangs" plays 8 seconds, so the run is seen before its game ends.
    const deck = await commanderDeck(api, `Hangs played ${stamp}`)
    const piper = await commanderDeck(api, `Played Piper ${stamp}`, PIPER)
    const run = await startRun(api, deck.id, [{ deck: piper.id }], { games: 1, lookahead: 'light' })

    await openRun(page, run.id)
    // Before any game: only the look-ahead. Spec 031, AC-5 adds the run's Forge choice.
    expect(await tooltip(page, runCard(page).getByTestId('run-forge').getByRole('button'))).toBe('Look-ahead Light · Auto')
    await waitForRun(api, run.id)
    await page.reload()
    expect(await tooltip(page, runCard(page).getByTestId('run-forge').getByRole('button'))).toBe('Forge fake · Look-ahead Light · Auto')
    expect(await tooltip(page, runCard(page).getByTestId('game-number').first())).toBe('Main · Forge fake')

    // A run from before this spec.
    asBefore029(run.id)
    await page.reload()
    expect(await tooltip(page, runCard(page).getByTestId('run-forge').getByRole('button'))).toBe('Forge 2.0.15 · Look-ahead Off · Auto')
    expect(await tooltip(page, runCard(page).getByTestId('game-number').first())).toBe('Forge 2.0.15')
  })
})
