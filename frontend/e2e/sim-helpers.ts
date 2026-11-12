import { execFileSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import type { apiAs } from './helpers'

// Specs 024 and 025: pod simulation against the fake Forge service (backend/sims/management/commands/fake_forge.py).
// Its card list leaves out Abstergo Entertainment, Brotherhood Headquarters, Dockside Extortionist and
// Shivan Dragon,
// so they are unsupported.
// A deck named "Hangs" plays 8 seconds a game, "Broken" fails and "Stalls" is a draw; others take a second.
export type Api = Awaited<ReturnType<typeof apiAs>>
type Seat = { deck: number } | { pool: number }
type Group = 'Opponent pool' | 'My decks' | 'Public decks'

export const KRENKO = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n36 Forest\n30 Llanowar Elves\n24 Temur Sabertooth\n9 Giant Growth'
export const PIPER = 'Commander\n1 The Prismatic Piper\n\nDeck\n40 Forest\n30 Llanowar Elves\n29 Temur Sabertooth'

export const commanderDeck = (api: Api, name: string, text = KRENKO, extra: Record<string, unknown> = {}) =>
  api.deck(name, 'commander', { text, ...extra })

export const seats = (page: Page) => page.getByTestId('sim-seat')
export const picker = (page: Page) => page.getByTestId('opponent-picker')
/** Rows of the run list on the Simulations page. */
export const rows = (page: Page) => page.getByTestId('sim-run-row')
/** The full run card on a run's page. */
export const runCard = (page: Page) => page.getByTestId('sim-run')

export async function openSimulations(page: Page, query = '') {
  await page.goto(`/simulations${query}`)
  await expect(page.getByTestId('simulations')).toBeVisible()
}

export async function openRun(page: Page, runId: number) {
  await page.goto(`/simulations/${runId}`)
  await expect(runCard(page)).toBeVisible()
}

/** Pick a deck for seat `seat` (1-based; seat 1 is the tested deck) from a picker group. */
export async function pickDeck(page: Page, seat: number, group: Group, name: string) {
  const s = seats(page).nth(seat - 1)
  await expect(s.getByRole('combobox')).toBeVisible()
  const empty = s.getByRole('button', { name: /^Choose (deck|opponent)$/ })
  await ((await empty.count()) ? empty : s.getByTestId('seat-tile')).click()
  await picker(page).getByLabel('Search opponents').fill(name)
  await picker(page).getByRole('tab', { name: group }).click()
  await picker(page).getByRole('tabpanel').getByRole('button', { name, exact: true }).click()
  await expect(picker(page)).toBeHidden()
}

/** Remove empty seats, so the pod is what was picked. */
export async function dropEmptySeats(page: Page) {
  for (let i = (await seats(page).count()) - 1; i >= 0; i--) {
    const s = seats(page).nth(i)
    if (await s.getByRole('button', { name: 'Choose opponent' }).count()) await s.getByRole('button', { name: 'Remove seat' }).click()
  }
}

/** Start a run through the API with `tested` in seat 0; returns it. */
export async function startRun(api: Api, tested: number | Seat, opponents: Seat[], extra: Record<string, unknown> = {}) {
  const first = typeof tested === 'number' ? { deck: tested } : tested
  return api.post('/api/sims/runs/', { seats: [first, ...opponents], games: 2, minutes: 1, ...extra })
}

export async function waitForRun(api: Api, runId: number, status = 'done', timeout = 60_000) {
  await expect.poll(async () => (await api.get(`/api/sims/runs/${runId}/`)).status, { timeout }).toBe(status)
  return api.get(`/api/sims/runs/${runId}/`)
}

/** Make a user an admin (staff), straight in the e2e database. */
export function makeStaff(username: string) {
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c',
    `from users.models import User; User.objects.filter(username='${username}').update(is_staff=True)`], {
    cwd: new URL('../../backend/', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL },
  })
}

/**
 * Spec 026: a finished 2-player game of the recorded Krenko deck (seat 1, plays first) against Piper,
 * opened on its replay page. Game turn 3 (Krenko's turn 2) holds a full combat: an attack, a block,
 * Giant Growth and the blocker dying.
 */
export async function openReplay(page: Page, api: Api, prefix = 'Replay') {
  const stamp = Date.now()
  const a = `${prefix} Krenko ${stamp}`
  const b = `${prefix} Piper ${stamp}`
  const deck = await commanderDeck(api, a)
  const piper = await commanderDeck(api, b, PIPER)
  const run = await startRun(api, deck.id, [{ deck: piper.id }], { games: 1 })
  await waitForRun(api, run.id)
  await page.goto(`/simulations/${run.id}/games/1`)
  await expect(page.getByTestId('replay-turn')).toHaveText('Before the game')
  return { a, b, run }
}
export const replayPlayer = (page: Page, name: string) => page.getByTestId('replay-player').filter({ has: page.getByText(name, { exact: true }) })
export const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Events' })
export const replayEvents = (page: Page) => sidebar(page).getByTestId('replay-event')
/** Shift + → a few turns: 3 reaches game turn 3. */
export async function turnsAhead(page: Page, n: number) {
  for (let i = 0; i < n; i++) await page.keyboard.press('Shift+ArrowRight')
}
