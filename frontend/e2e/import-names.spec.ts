import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 016: single-slash names import as two-part cards (AC-1, AC-2).
test.describe('Single-slash names', () => {
  test('AC-1, AC-2: `Fire / Ice` imports into the collection and a deck; names without spaces stay', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const preview = await api.post('/api/imports/preview/', { text: '1 Fire / Ice (MH2) 290\n1 Fire/Ice\n2 Fire // Ice' })
    expect(preview.rows.map((r: { printing: { name: string } }) => r.printing.name)).toEqual(['Fire // Ice', 'Fire // Ice'])
    expect(preview.errors.map((e: { line: number; reason: string }) => [e.line, e.reason])).toEqual([[2, 'No card named "Fire/Ice".']])

    const deck = await api.deck('Slash', 'casual', { text: 'Deck\n1 Fire / Ice (MH2) 290' })
    expect((await api.get(`/api/decks/${deck.id}/`)).cards.map((c: { printing: { name: string } }) => c.printing.name)).toEqual(['Fire // Ice'])

    // Through the import dialog too.
    await page.goto('/cards')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Import' }).click()
    await page.getByRole('dialog').getByRole('textbox').first().fill('1 Fire / Ice (MH2) 290')
    await page.getByRole('dialog').getByRole('button', { name: /Preview|Next/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Fire // Ice')
  })
})
