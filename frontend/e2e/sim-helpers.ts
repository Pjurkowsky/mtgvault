import { expect, type Page } from '@playwright/test'
import type { apiAs } from './helpers'

// Spec 024: pod simulation against the fake Forge service (backend/sims/management/commands/fake_forge.py).
// Its card list leaves out Abstergo Entertainment, Brotherhood Headquarters, Dockside Extortionist and
// Shivan Dragon,
// so they are unsupported.
// A deck named "Hangs" plays 8 seconds a game, "Broken" fails and "Stalls" is a draw; others take a second.
export type Api = Awaited<ReturnType<typeof apiAs>>

export const KRENKO = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n36 Forest\n30 Llanowar Elves\n24 Temur Sabertooth\n9 Giant Growth'
export const PIPER = 'Commander\n1 The Prismatic Piper\n\nDeck\n40 Forest\n30 Llanowar Elves\n29 Temur Sabertooth'

export const commanderDeck = (api: Api, name: string, text = KRENKO, extra: Record<string, unknown> = {}) =>
  api.deck(name, 'commander', { text, ...extra })

export const seats = (page: Page) => page.getByTestId('sim-seat')
export const picker = (page: Page) => page.getByTestId('opponent-picker')
export const runs = (page: Page) => page.getByTestId('sim-run')

export async function openSimulate(page: Page, deckId: number, username?: string) {
  await page.goto(username ? `/u/${username}/decks/${deckId}?tab=simulate` : `/decks/${deckId}?tab=simulate`)
  await expect(page.getByTestId('deck-simulate')).toBeVisible()
}

/** Pick a deck for seat `seat` (1-based) from a picker group. */
export async function pickOpponent(page: Page, seat: number, group: 'Opponent pool' | 'My decks' | 'Public decks', name: string) {
  const s = seats(page).nth(seat - 1)
  await expect(s.getByRole('combobox')).toBeVisible()
  const empty = s.getByRole('button', { name: 'Choose opponent' })
  await ((await empty.count()) ? empty : s.getByTestId('seat-tile')).click()
  await picker(page).getByLabel('Search opponents').fill(name)
  await picker(page).getByRole('tab', { name: group }).click()
  await picker(page).getByRole('tabpanel').getByRole('button', { name, exact: true }).click()
  await expect(picker(page)).toBeHidden()
}

/** Remove empty opponent seats, so the pod is what was picked. */
export async function dropEmptySeats(page: Page) {
  for (let i = (await seats(page).count()) - 1; i >= 0; i--) {
    const s = seats(page).nth(i)
    if (await s.getByRole('button', { name: 'Choose opponent' }).count()) await s.getByRole('button', { name: 'Remove seat' }).click()
  }
}

/** Start a run through the API; returns it. */
export async function startRun(api: Api, deckId: number, opponents: ({ deck: number } | { pool: number })[], extra: Record<string, unknown> = {}) {
  return api.post(`/api/decks/${deckId}/sims/`, { seats: [{ deck: deckId }, ...opponents], games: 2, minutes: 1, ...extra })
}

export async function waitForRun(api: Api, runId: number, status = 'done', timeout = 60_000) {
  await expect.poll(async () => (await api.get(`/api/sims/runs/${runId}/`)).status, { timeout }).toBe(status)
  return api.get(`/api/sims/runs/${runId}/`)
}
