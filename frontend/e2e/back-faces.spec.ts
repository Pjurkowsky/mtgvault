import { expect, test } from '@playwright/test'
import { cardDialog, deckRow, signUpAndLogIn, tile } from './helpers'

// Spec 023: the back of double-faced cards (AC-15 to AC-17).
const DELVER = 'Delver of Secrets // Insectile Aberration'

test.describe('Back faces', () => {
  test('AC-15, AC-16: Turn over in the card dialog and the fullscreen view', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.importList('1 Delver of Secrets (ISD) 51\n1 Fire // Ice (MH2) 290')
    const items = await api.get('/api/items/')
    const delver = items.results.find((r: { printing: { name: string } }) => r.printing.name === DELVER)
    expect(delver.printing.image_back_normal).toContain('/back/')
    const fire = items.results.find((r: { printing: { name: string } }) => r.printing.name === 'Fire // Ice')
    expect(fire.printing.image_back_normal).toBe('') // a split card shares one image

    await page.goto('/cards')
    await tile(page, 'Fire // Ice').click()
    await expect(cardDialog(page).getByTestId('detail-image')).toBeVisible()
    await expect(cardDialog(page).getByTestId('turn-over')).toHaveCount(0)
    await page.keyboard.press('Escape')

    await tile(page, DELVER).click()
    const image = cardDialog(page).getByTestId('detail-image')
    await expect(image).toHaveAttribute('src', /\/front\//)
    await cardDialog(page).getByTestId('turn-over').click()
    await expect(image).toHaveAttribute('src', /\/back\//)
    await cardDialog(page).getByTestId('turn-over').click()
    await expect(image).toHaveAttribute('src', /\/front\//)

    await image.click()
    const full = page.getByTestId('fullscreen-image')
    await expect(full).toHaveAttribute('src', /\/front\//)
    await page.getByTestId('fullscreen').getByTestId('turn-over').click()
    await expect(full).toHaveAttribute('src', /\/back\//)
    await expect(page.getByTestId('fullscreen')).toBeVisible() // turning over doesn't close it
  })

  test('AC-17: hovering a double-faced card shows both faces', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Faces', 'casual', { text: '1 Delver of Secrets\n1 Sol Ring' })
    await page.goto(`/decks/${deck.id}`)
    await deckRow(page, DELVER).hover()
    const faces = page.getByTestId('faces-preview')
    await expect(faces.getByTestId('card-preview')).toHaveAttribute('src', /\/front\//)
    await expect(faces.getByTestId('card-preview-back')).toHaveAttribute('src', /\/back\//)

    await page.mouse.move(0, 0)
    await deckRow(page, 'Sol Ring').hover()
    await expect(page.getByTestId('card-preview')).toBeVisible()
    await expect(page.getByTestId('faces-preview')).toHaveCount(0)
  })
})
