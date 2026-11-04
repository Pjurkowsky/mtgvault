import { expect, test, type Page } from '@playwright/test'
import { signUpAndLogIn } from './helpers'

// Spec 005: scanning from a deck (AC-16, AC-17), with the fake camera showing Sol Ring.
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000

async function scanFromDeck(page: Page, deckId: number, choice?: string) {
  await page.goto(`/decks/${deckId}`)
  await page.getByRole('button', { name: 'Scan cards' }).click()
  const dialog = page.getByTestId('scan-target')
  if (choice) await dialog.getByRole('radio', { name: choice }).click()
  await dialog.getByRole('button', { name: 'Scan' }).click()
  await expect(page).toHaveURL(new RegExp(`/scan\\?deck=${deckId}$`))
  await expect(page.getByTestId('scanner')).toBeVisible()
}

test('AC-16, AC-17: scans into the deck box skip the cart and join the decklist', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  const deck = await api.deck('Scanned', 'casual', { create_box: true })
  await scanFromDeck(page, deck.id)
  await expect(page.getByTestId('scan-destination')).toHaveText('Scanned')
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect(page.getByTestId('result-name')).toHaveText('Sol Ring')
  await expect(page.getByTestId('running-total')).toContainText('1 card')

  expect((await api.get(`/api/items/?location=${deck.location}`)).count).toBe(1)
  expect((await api.get('/api/items/?location=cart')).count).toBe(0)
  const cards = (await api.get(`/api/decks/${deck.id}/`)).cards
  expect(cards.map((c: { zone: string; printing: { name: string } }) => [c.zone, c.printing.name])).toEqual([['main', 'Sol Ring']])

  await page.getByRole('button', { name: 'Close scanner' }).click()
  await expect(page).toHaveURL(new RegExp(`/decks/${deck.id}$`))
})

test('AC-16, AC-17: decklist only adds no copies; +1 and Undo change the list; the choice is remembered and changeable', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  const deck = await api.deck('List only', 'casual')
  await scanFromDeck(page, deck.id, 'The decklist only')
  await expect(page.getByTestId('scan-destination')).toHaveText('List only')
  await expect(page.getByTestId('result-bar')).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')
  const quantity = async () => (await api.get(`/api/decks/${deck.id}/`)).cards[0]?.quantity ?? 0

  await page.getByTestId('result-bar').getByRole('button', { name: '1' }).click()
  await expect(page.getByTestId('result-quantity')).toHaveText('×2')
  expect(await quantity()).toBe(2)
  await page.getByTestId('result-bar').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('result-quantity')).toHaveText('×1')
  expect(await quantity()).toBe(1)
  expect((await api.get('/api/items/')).count).toBe(0)
  expect((await api.get('/api/items/?location=cart')).count).toBe(0)

  // Changed on the scanner, remembered for the deck.
  await page.getByRole('button', { name: 'Change' }).click()
  await page.getByTestId('scan-target').getByRole('radio', { name: 'The cart' }).click()
  await page.getByTestId('scan-target').getByRole('button', { name: 'Use' }).click()
  await expect(page.getByTestId('scan-destination')).toHaveText('Cart')
  await page.goto(`/decks/${deck.id}`)
  await page.getByRole('button', { name: 'Scan cards' }).click()
  await expect(page.getByTestId('scan-target').getByRole('radio', { name: 'The cart' })).toBeChecked()
})
