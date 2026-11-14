import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, openRun, openSimulations, rows, runCard, startRun, waitForRun } from './sim-helpers'

// Spec 031, AC-7 to AC-9: where each game played and how long it took. Main (this server's Forge)
// is the e2e fake Forge at 127.0.0.1:8190; Other is empty while this project runs.
const MAIN_HOST = `127.0.0.1:${Number(process.env.E2E_FORGE_PORT ?? 8190)}`

test('AC-7 to AC-9: games show their Forge and time, live while playing; the run its time', async ({ page, request }) => {
  test.setTimeout(150_000)
  const { api } = await signUpAndLogIn(page, request)
  const stamp = Date.now()
  // "Hangs" plays 8 seconds.
  const deck = await commanderDeck(api, `Hangs timed ${stamp}`)
  const piper = await commanderDeck(api, `Timed Piper ${stamp}`, PIPER)
  const run = await startRun(api, deck.id, [{ deck: piper.id }], { games: 1 })

  // AC-8: playing now, where, and for how long; AC-9: running time.
  await openRun(page, run.id)
  const live = runCard(page).getByTestId('run-playing')
  // It may wait behind other runs: Main plays one game at a time.
  await expect(live).toContainText(`Game 1Playing on ${MAIN_HOST}`, { timeout: 60_000 })
  await expect(live.getByTestId('playing-time')).toHaveText(/^\d+s$/)
  await expect(runCard(page).getByTestId('run-time')).toHaveText(/^Running \d+(s|m) · games \d+s$/)

  const done = await waitForRun(api, run.id, 'done', 90_000)
  await page.reload()
  await expect(live).toHaveCount(0)
  // AC-7: the address and the time; hovering the address names the Forge.
  const game = runCard(page).getByTestId('run-game').first()
  await expect(game.getByTestId('game-url')).toHaveText(MAIN_HOST)
  const seconds = Math.round(done.results[0].duration_ms / 1000)
  await expect(game.getByTestId('game-time')).toHaveText(`${seconds}s`)
  expect(seconds).toBeGreaterThanOrEqual(8)
  await game.getByTestId('game-url').hover()
  await expect(page.getByRole('tooltip')).toHaveText('Main · Forge fake')
  await page.mouse.move(0, 0)
  // AC-9: start to end, then the sum of the game times.
  await expect(runCard(page).getByTestId('run-time')).toHaveText(new RegExp(`^Took \\d+s · games ${seconds}s$`))
  // The Simulations list shows the same.
  await openSimulations(page, `?q=${stamp}`)
  await expect(rows(page).first().getByTestId('run-row-time')).toHaveText(new RegExp(`^Took \\d+s · games ${seconds}s$`))

  // A game from before this spec: no address, its time still shows.
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c', `from sims.models import SimGame; SimGame.objects.filter(run_id=${run.id}).update(forge_url='', forge_server='')`], {
    cwd: new URL('../../backend/', import.meta.url).pathname, env: { ...process.env, DATABASE_URL },
  })
  await openRun(page, run.id)
  await expect(game.getByTestId('game-url')).toHaveCount(0)
  await expect(game.getByTestId('game-time')).toHaveText(`${seconds}s`)
})
