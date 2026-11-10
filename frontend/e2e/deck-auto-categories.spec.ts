import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { cardDialog, closeCardDialog, deckRow, signUpAndLogIn } from './helpers'

// Spec 022: deck cards get categories from Scryfall's tags (AC-1 to AC-5).
type Card = { id: number; zone: string; categories: string[]; printing: { id: string; name: string } }
const byName = (deck: { cards: Card[] }, name: string, zone = 'main') => deck.cards.find((c) => c.printing.name === name && c.zone === zone)!

/** Run Python in the e2e backend and return what it prints. */
function shell(code: string) {
  return execFileSync('uv', ['run', 'manage.py', 'shell', '-c', code], { cwd: '../backend', env: { ...process.env, DATABASE_URL } }).toString()
}

test.describe('Automatic categories', () => {
  test('AC-1, AC-2: added cards get every matching category in order, however they are added', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    let deck = await api.deck('Auto', 'casual', { text: '1 Lightning Helix\n1 Forest\n1 Giant Growth' })
    const printings = async (q: string) => {
      const found = (await api.get(`/api/catalog/cards/?q=${encodeURIComponent(q)}`))[0]
      return (await api.get(`/api/catalog/cards/${found.oracle_id}/printings/`)) as { id: string }[]
    }
    const card = async (q: string) => (await printings(q))[0]

    // Add card, into the Maybeboard too.
    deck = await api.post(`/api/decks/${deck.id}/cards/`, { printing: (await card('Sol Ring')).id })
    deck = await api.post(`/api/decks/${deck.id}/cards/`, { printing: (await card('Smothering Tithe')).id, zone: 'maybe' })
    // Proposed as a swap: a new Maybeboard card.
    deck = await api.post(`/api/decks/${deck.id}/swaps/`, { out: byName(deck, 'Giant Growth').id, printing: (await card('Counterspell')).id })

    expect(byName(deck, 'Lightning Helix').categories).toEqual(['Removal', 'Lifegain', 'Burn'])
    expect(byName(deck, 'Sol Ring').categories).toEqual(['Ramp'])
    expect(byName(deck, 'Smothering Tithe', 'maybe').categories).toEqual(['Ramp', 'Tokens', 'Stax'])
    expect(byName(deck, 'Counterspell', 'maybe').categories).toEqual(['Counterspell'])
    expect(byName(deck, 'Forest').categories).toEqual([]) // lands get none
    expect(byName(deck, 'Giant Growth').categories).toEqual([]) // no matching tag

    // The card dialog shows them; the first is primary and groups the card.
    await page.goto(`/decks/${deck.id}?group=category`)
    await expect(page.getByTestId('group-main-Removal')).toContainText('Lightning Helix')
    await expect(page.getByTestId('group-main-Ramp')).toContainText('Sol Ring')
    await deckRow(page, 'Lightning Helix').click()
    await expect(cardDialog(page).getByTestId('category-chip')).toHaveText(['Removal', 'Lifegain', 'Burn'])
    await closeCardDialog(page)
  })

  test('AC-4: import tags replace the automatic ones on new cards and add to existing ones', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    let deck = await api.deck('Imported', 'casual', { text: '1 Sol Ring #Fast\n1 Lightning Bolt' })
    expect(byName(deck, 'Sol Ring').categories).toEqual(['Fast'])
    expect(byName(deck, 'Lightning Bolt').categories).toEqual(['Removal', 'Burn'])

    deck = await api.post(`/api/decks/${deck.id}/import/`, { text: '1 Lightning Bolt #Finisher' })
    expect(byName(deck, 'Lightning Bolt').categories).toEqual(['Removal', 'Burn', 'Finisher'])
  })

  test('AC-5: moving zones and changing the printing keep categories', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    let deck = await api.deck('Moves', 'casual', { text: '1 Lightning Bolt' })
    const bolt = byName(deck, 'Lightning Bolt')
    deck = await api.patch(`/api/decks/${deck.id}/cards/${bolt.id}/`, { categories: ['Mine'] })
    deck = await api.patch(`/api/decks/${deck.id}/cards/${bolt.id}/`, { zone: 'side' })
    expect(byName(deck, 'Lightning Bolt', 'side').categories).toEqual(['Mine'])
    const found = (await api.get('/api/catalog/cards/?q=Lightning+Bolt'))[0]
    const all = (await api.get(`/api/catalog/cards/${found.oracle_id}/printings/`)) as { id: string }[]
    const other = all.find((p) => p.id !== bolt.printing.id)!
    deck = await api.patch(`/api/decks/${deck.id}/cards/${bolt.id}/`, { printing: other.id })
    expect(byName(deck, 'Lightning Bolt', 'side').categories).toEqual(['Mine'])
  })

  test('AC-3: the first tag sync replaces every deck card\'s categories; later syncs keep your edits', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Old', 'casual', { text: '1 Sol Ring #Artifacts\n1 Forest #Lands\n1 Giant Growth #Pump' })

    // A later sync (the server already ran the first one) leaves them alone.
    shell("from cards.tags import sync_tags; sync_tags('cards/fixtures/oracle-tags-sample.jsonl')")
    const after = await api.get(`/api/decks/${deck.id}/`)
    expect(byName(after, 'Sol Ring').categories).toEqual(['Artifacts'])

    // The first one, in a transaction rolled back so other tests never see it.
    const out = shell(`
import json
from django.db import transaction
from cards.models import SyncRun
from cards.tags import sync_tags
from decks.models import DeckCard
with transaction.atomic():
    SyncRun.objects.filter(kind='tags').delete()
    sync_tags('cards/fixtures/oracle-tags-sample.jsonl')
    rows = DeckCard.objects.filter(deck__user__username='${user.username}').values_list('printing__name', 'categories')
    print(json.dumps(dict(rows)))
    transaction.set_rollback(True)
`)
    expect(JSON.parse(out.trim().split('\n').pop()!)).toEqual({ 'Sol Ring': ['Ramp'], Forest: [], 'Giant Growth': [] })
  })
})
