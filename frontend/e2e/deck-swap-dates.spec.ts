import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { signUpAndLogIn } from './helpers'

// Spec 028: sort swaps by date (AC-1 to AC-5).
type Api = Awaited<ReturnType<typeof signUpAndLogIn>>['api']
type Card = { id: number; zone: string; printing: { name: string }; swap_for: number[]; swap_dates: Record<string, string | null> }

const cards = async (api: Api, deck: number, query = '') => (await api.get(`/api/decks/${deck}/${query}`)).cards as Card[]
const find = (list: Card[], name: string, zone?: string) => list.find((c) => c.printing.name === name && (!zone || c.zone === zone))!

/** Set a pair's date (or clear it, like pairs from before spec 028) straight in the e2e database. */
function dated(candidate: number, out: number, iso: string | null) {
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c',
    `from decks.models import DeckSwap; DeckSwap.objects.filter(candidate_id=${candidate}, out_id=${out}).update(created_at=${iso ? `'${iso}'` : 'None'})`], {
    cwd: new URL('../../backend/', import.meta.url).pathname, env: { ...process.env, DATABASE_URL },
  })
}
function added(card: number, iso: string) {
  execFileSync('uv', ['run', 'manage.py', 'shell', '-c',
    `from decks.models import DeckCard; DeckCard.objects.filter(pk=${card}).update(created_at='${iso}')`], {
    cwd: new URL('../../backend/', import.meta.url).pathname, env: { ...process.env, DATABASE_URL },
  })
}

const sections = (page: Page) => page.getByTestId('deck-swaps').locator('section[data-testid^="swap-"]:not([data-testid="swap-unpaired"])')
const sectionNames = async (page: Page) => (await sections(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(5))))

async function sortBy(page: Page, key: 'Name' | 'Date') {
  await page.getByTestId('swap-sort').click()
  await page.getByRole('option', { name: key }).click()
}

test.describe('Swap dates', () => {
  test('AC-1 to AC-4: sort by name or date either way, remembered; dates in tooltips; old swaps count as oldest', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Dated', 'casual', {
      text: 'Deck\n1 Lightning Bolt\n1 Forest\n1 Sol Ring\n\nMaybeboard\n1 Shivan Dragon\n1 Counterspell\n1 Brainstorm\n1 Llanowar Elves',
    })
    let list = await cards(api, deck.id)
    const id = (name: string) => find(list, name).id
    // Bolt ← Shivan (Mar 1) and Counterspell (Jan 1); Forest ← Brainstorm (Feb 1); Sol Ring ← Llanowar Elves (no date).
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Shivan Dragon') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Counterspell') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Forest'), card: id('Brainstorm') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Sol Ring'), card: id('Llanowar Elves') })
    dated(id('Shivan Dragon'), id('Lightning Bolt'), '2026-03-01T12:00:00Z')
    dated(id('Counterspell'), id('Lightning Bolt'), '2026-01-01T12:00:00Z')
    dated(id('Brainstorm'), id('Forest'), '2026-02-01T12:00:00Z')
    dated(id('Llanowar Elves'), id('Sol Ring'), null)
    // Unpaired: Giant Growth added Apr 1, Temur Sabertooth Feb 1.
    await api.post(`/api/decks/${deck.id}/import/`, { text: 'Maybeboard\n1 Giant Growth\n1 Temur Sabertooth' })
    list = await cards(api, deck.id)
    added(id('Giant Growth'), '2026-04-01T12:00:00Z')
    added(id('Temur Sabertooth'), '2026-02-01T12:00:00Z')

    await page.goto(`/decks/${deck.id}?tab=swaps`)
    const bolt = page.getByTestId('swap-Lightning Bolt').getByTestId('swap-in')
    const unpaired = page.getByTestId('unpaired-card')

    // AC-1: Name A→Z to start.
    await expect(page.getByTestId('swap-sort')).toHaveText('Name')
    expect(await sectionNames(page)).toEqual(['Forest', 'Lightning Bolt', 'Sol Ring'])
    await expect(bolt).toHaveText([/Counterspell/, /Shivan Dragon/])
    await page.getByTestId('swap-direction').click()
    expect(await sectionNames(page)).toEqual(['Sol Ring', 'Lightning Bolt', 'Forest'])
    await expect(unpaired).toHaveText([/Temur Sabertooth/, /Giant Growth/])

    // AC-2: Date starts newest first; sections by their newest proposal, undated last (AC-3).
    await sortBy(page, 'Date')
    await expect(page.getByTestId('swap-direction')).toHaveAttribute('data-direction', 'desc')
    expect(await sectionNames(page)).toEqual(['Lightning Bolt', 'Forest', 'Sol Ring'])
    await expect(bolt).toHaveText([/Shivan Dragon/, /Counterspell/])
    await expect(unpaired).toHaveText([/Giant Growth/, /Temur Sabertooth/])
    await page.getByTestId('swap-direction').click()
    expect(await sectionNames(page)).toEqual(['Sol Ring', 'Forest', 'Lightning Bolt'])
    await expect(bolt).toHaveText([/Counterspell/, /Shivan Dragon/])

    // Remembered for all decks.
    await page.reload()
    await expect(page.getByTestId('swap-sort')).toHaveText('Date')
    await expect(page.getByTestId('swap-direction')).toHaveAttribute('data-direction', 'asc')
    // Name resets to A→Z.
    await sortBy(page, 'Name')
    await expect(page.getByTestId('swap-direction')).toHaveAttribute('data-direction', 'asc')

    // AC-4: tooltips.
    const shivan = page.getByTestId('swap-Lightning Bolt').getByTestId('swap-candidate').filter({ hasText: 'Shivan Dragon' })
    await shivan.getByTestId('swap-when').hover()
    await expect(page.getByRole('tooltip')).toHaveText(`Proposed ${new Date('2026-03-01T12:00:00Z').toLocaleDateString('en-US', { dateStyle: 'medium' })}`)
    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await unpaired.filter({ hasText: 'Giant Growth' }).getByTestId('pair-with').hover()
    await expect(page.getByRole('tooltip')).toHaveText(`Added ${new Date('2026-04-01T12:00:00Z').toLocaleDateString('en-US', { dateStyle: 'medium' })}`)
    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await page.getByTestId('swap-Sol Ring').getByTestId('swap-when').hover()
    await page.waitForTimeout(800)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })

  test('AC-5: versions, branches and forks keep swap dates; applying a swap dates the swap back now', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Kept', 'casual', { text: 'Deck\n1 Lightning Bolt\n\nMaybeboard\n1 Shivan Dragon\n1 Counterspell' })
    let list = await cards(api, deck.id)
    const id = (name: string) => find(list, name).id
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Shivan Dragon') })
    await api.post(`/api/decks/${deck.id}/swaps/`, { out: id('Lightning Bolt'), card: id('Counterspell') })
    dated(id('Shivan Dragon'), id('Lightning Bolt'), '2026-03-01T12:00:00Z')
    const when = (l: Card[], name: string) => {
      const c = find(l, name, 'maybe')
      return c.swap_dates[String(c.swap_for[0])]
    }
    const main = (await api.get(`/api/decks/${deck.id}/branches/`)).branches[0].id
    const saved = (await api.post(`/api/decks/${deck.id}/branches/${main}/versions/`, {})).branches[0].versions[0].id
    expect(when((await api.get(`/api/decks/${deck.id}/versions/${saved}/`)).cards, 'Shivan Dragon')).toMatch(/^2026-03-01/)

    const { created } = await api.post(`/api/decks/${deck.id}/branches/`, { name: 'Copy' })
    expect(when(await cards(api, deck.id, `?branch=${created}`), 'Shivan Dragon')).toMatch(/^2026-03-01/)
    const fork = await api.post(`/api/decks/${deck.id}/fork/`, {})
    expect(when(await cards(api, fork.id), 'Shivan Dragon')).toMatch(/^2026-03-01/)

    // Apply Counterspell: Bolt goes to the Maybeboard proposed back, dated now; Shivan moves over with its date.
    await api.post(`/api/decks/${deck.id}/cards/${id('Counterspell')}/apply-swap/`, { out: id('Lightning Bolt') })
    list = await cards(api, deck.id)
    expect(when(list, 'Shivan Dragon')).toMatch(/^2026-03-01/)
    expect(Date.now() - Date.parse(when(list, 'Lightning Bolt')!)).toBeLessThan(60_000)

    // Restore keeps them too.
    await api.post(`/api/decks/${deck.id}/versions/${saved}/restore/`)
    expect(when(await cards(api, deck.id), 'Shivan Dragon')).toMatch(/^2026-03-01/)
  })
})
