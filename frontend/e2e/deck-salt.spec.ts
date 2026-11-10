import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { signUpAndLogIn } from './helpers'

// Spec 022: deck salt and commander themes from EDHREC fixtures (AC-12 to AC-15).
// Salt in the fixtures: Rhystic Study 2.82, Smothering Tithe 2.62, Sol Ring 1.59;
// Dockside Extortionist has no score on EDHREC and Forest no page.
const LIST = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Rhystic Study\n1 Smothering Tithe\n1 Sol Ring\n1 Dockside Extortionist\n1 Forest\n\nMaybeboard\n1 Cloudstone Curio'

test.describe('Deck salt and themes', () => {
  test('AC-12, AC-13, AC-14: the header and the Stats tab show the deck salt', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Salty', 'commander', { text: LIST })
    await page.goto(`/decks/${deck.id}`)
    // 2.82 + 2.62 + 1.59; Maybeboard cards don't count, unrated cards count 0.
    await expect(page.getByTestId('deck-salt')).toHaveText('Salt 7')
    await page.getByTestId('deck-salt').click()
    await expect(page).toHaveURL(/tab=stats/)

    const card = page.getByTestId('salt-card')
    await expect(card.getByTestId('salt-total')).toHaveText('7.0')
    await expect(card).toContainText('Average 36')
    await expect(card).toContainText('72')
    const width = await card.getByTestId('salt-fill').evaluate((el) => (el as HTMLElement).style.width)
    expect(parseFloat(width)).toBeCloseTo((7.0336 / 72) * 100, 0)
    await card.getByTestId('salt-meter').hover()
    await expect(page.getByTestId('salt-top').first()).toContainText('Rhystic Study2.82Smothering Tithe2.62Sol Ring1.59')

    // Stored, so the next load has it straight away.
    const again = await api.get(`/api/decks/${deck.id}/`)
    expect(again.salt.pending).toBe(0)
    expect(again.salt.total).toBeCloseTo(7.03, 1)
  })

  test('AC-14: a score older than 30 days is fetched again', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Stale', 'casual', { text: '1 Rhystic Study' })
    await api.get(`/api/decks/${deck.id}/insights/`)
    execFileSync('uv', ['run', 'manage.py', 'shell', '-c', `
from datetime import timedelta
from django.utils import timezone
from cards.models import CardInsight, Printing
oracle = Printing.objects.filter(name='Rhystic Study').first().oracle_id
CardInsight.objects.filter(oracle_id=oracle).update(salt=0, salt_checked_at=timezone.now() - timedelta(days=31))
`], { cwd: '../backend', env: { ...process.env, DATABASE_URL } })
    // Other tests may refresh it first; either way the stale 0 is gone after a load.
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('deck-salt')).toHaveText('Salt 3')
  })

  test('AC-13: a deck without counted cards shows no salt', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Empty', 'casual', { text: 'Maybeboard\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await expect(page.getByTestId('deck-size')).toBeVisible()
    await expect(page.getByTestId('deck-salt')).toHaveCount(0)
    await page.goto(`/decks/${deck.id}?tab=stats`)
    await expect(page.getByTestId('salt-card')).toHaveCount(0)
  })

  test('AC-15: a Commander deck shows its commander\'s EDHREC themes', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Goblins', 'commander', { text: LIST })
    await page.goto(`/decks/${deck.id}?tab=stats`)
    const themes = page.getByTestId('themes').getByTestId('theme')
    await expect(themes).toHaveCount(8)
    await expect(themes.first()).toHaveText('Goblins 4,222')
    await expect(themes.first()).toHaveAttribute('href', 'https://edhrec.com/commanders/krenko-mob-boss/goblins')
    await expect(themes.nth(1)).toHaveText('Tokens 2,670')

    // No EDHREC data for this commander, and no commander at all: no themes card.
    const piper = await api.deck('Piper', 'commander', { text: 'Commander\n1 The Prismatic Piper\n\nDeck\n1 Sol Ring' })
    await page.goto(`/decks/${piper.id}?tab=stats`)
    await expect(page.getByTestId('salt-card')).toBeVisible()
    await expect(page.getByTestId('themes')).toHaveCount(0)
    const casual = await api.deck('Casual', 'casual', { text: '1 Krenko, Mob Boss' })
    await page.goto(`/decks/${casual.id}?tab=stats`)
    await expect(page.getByTestId('salt-card')).toBeVisible()
    await expect(page.getByTestId('themes')).toHaveCount(0)
  })
})
