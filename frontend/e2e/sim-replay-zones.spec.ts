import { expect, test, type Locator } from '@playwright/test'
import { signUpAndLogIn } from './helpers'
import { openReplay, replayPlayer, turnsAhead } from './sim-helpers'

// Spec 026, AC-1 to AC-5: zones at the bottom of each panel, their cards as images, any card full screen,
// and rows that keep room for a line of cards.
const names = (list: Locator) =>
  list.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))

test.describe('Replay zones', () => {
  test.describe.configure({ timeout: 90_000 })

  test('AC-1, AC-2, AC-4: zones at the bottom, hand and library as images (top card first), cards full screen', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a } = await openReplay(page, api)
    const krenko = replayPlayer(page, a)

    // AC-1: four zones with counts, the panel's last part.
    const zones = krenko.getByTestId('player-zones')
    await expect(zones.getByRole('button')).toHaveText(['Hand 7', 'Library 92', 'Graveyard 0', 'Exile 0'])
    const panel = (await krenko.boundingBox())!
    const footer = (await zones.boundingBox())!
    expect(panel.y + panel.height - (footer.y + footer.height)).toBeLessThan(16)

    // AC-2: the hand, and the library top card first.
    await krenko.getByTestId('player-hand').click()
    const hand = page.getByTestId('zone-hand-list')
    expect(await names(hand)).toEqual(['Giant Growth', 'Forest', 'Temur Sabertooth', 'Temur Sabertooth', 'Llanowar Elves', 'Forest', 'Temur Sabertooth'])
    // The normal size image, so medium and large cards stay sharp (the small one is 146 px wide).
    await expect(hand.getByRole('img', { name: 'Forest' }).first()).toHaveAttribute('src', /scryfall.*\/normal\//)
    // AC-4: a card in a zone, full screen; Escape closes only the preview.
    await hand.getByRole('button', { name: 'Giant Growth' }).click()
    await expect(page.getByTestId('fullscreen')).toHaveAccessibleName('Giant Growth')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('fullscreen')).toBeHidden()
    await expect(hand).toBeVisible()
    // Clicking the preview closes only the preview, not the hand.
    await hand.getByRole('button', { name: 'Giant Growth' }).click()
    await page.getByTestId('fullscreen').click()
    await expect(page.getByTestId('fullscreen')).toBeHidden()
    await expect(hand).toBeVisible()
    // The dialog is nearly full screen, with S / M / L card sizes, remembered.
    const dialog = (await page.getByTestId('zone-hand-dialog').boundingBox())!
    expect(dialog.width).toBeGreaterThan(1200)
    await expect(hand).toHaveAttribute('data-size', 'md')
    await page.getByRole('radio', { name: 'Large cards' }).or(page.getByRole('button', { name: 'Large cards' })).click()
    await expect(hand).toHaveAttribute('data-size', 'lg')
    await page.keyboard.press('Escape')
    await krenko.getByTestId('player-graveyard').click()
    await page.keyboard.press('Escape')
    await krenko.getByTestId('player-hand').click()
    await expect(hand).toHaveAttribute('data-size', 'lg')
    await page.keyboard.press('Escape')
    await krenko.getByTestId('player-library').click()
    const library = page.getByTestId('zone-library-list')
    await expect(library.getByTestId('zone-card')).toHaveCount(92)
    expect((await names(library)).slice(0, 3)).toEqual(['Giant Growth', 'Llanowar Elves', 'Llanowar Elves'])
    await page.keyboard.press('Escape')

    // AC-4: a battlefield card and a commander, full screen.
    await turnsAhead(page, 3)
    await krenko.getByTestId('row-creature').getByTestId('board-card').first().click()
    await expect(page.getByTestId('fullscreen')).toHaveAccessibleName('Llanowar Elves')
    await page.keyboard.press('Escape')
    await krenko.getByTestId('player-commander').click()
    await expect(page.getByTestId('fullscreen')).toHaveAccessibleName('Krenko, Mob Boss')
    await page.keyboard.press('Escape')

    // The graveyard and exile open the same way.
    await krenko.getByTestId('player-exile').click()
    await expect(page.getByTestId('zone-exile-dialog')).toContainText('Empty')
  })

  test('AC-3: a game recorded before keeps counts, and its lists say the cards weren\'t recorded', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const { a } = await openReplay(page, api, 'Unrecorded')
    const krenko = replayPlayer(page, a)
    await expect(krenko.getByTestId('player-hand')).toHaveText('Hand 7')
    await krenko.getByTestId('player-hand').click()
    await expect(page.getByTestId('zone-unrecorded')).toHaveText('The cards weren\'t recorded for this game.')
    await page.keyboard.press('Escape')
    await krenko.getByTestId('player-library').click()
    await expect(page.getByTestId('zone-unrecorded')).toBeVisible()
    await page.keyboard.press('Escape')
    // No combat details either: the attack draws no arrow.
    await turnsAhead(page, 3)
    await page.getByRole('complementary', { name: 'Events' }).getByTestId('replay-event').nth(1).click()
    await expect(page.getByTestId('combat-arrow')).toHaveCount(0)
  })

  test('AC-5: empty rows keep room, so the first card entering moves nothing', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a } = await openReplay(page, api)
    const krenko = replayPlayer(page, a)
    const rows = krenko.getByTestId('row-cards')
    await expect(rows).toHaveCount(3)
    for (const box of await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThan(70)
    const zones = async () => (await krenko.getByTestId('player-zones').boundingBox())!.y
    const before = await zones()
    // Event by event into turn 1, until the first land is played.
    const lands = krenko.getByTestId('row-land').getByTestId('board-card')
    for (let i = 0; i < 6 && (await lands.count()) === 0; i++) await page.keyboard.press('ArrowRight')
    await expect(lands).toHaveCount(1)
    expect(await zones()).toBe(before)
  })

  test('AC-16: side by side, the board leans toward its centre; a right-hand player\'s life is on the left; one column on a phone', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a, b } = await openReplay(page, api)
    await turnsAhead(page, 3)
    const left = replayPlayer(page, a)
    const right = replayPlayer(page, b)
    await expect(left).toHaveAttribute('data-side', 'left')
    await expect(right).toHaveAttribute('data-side', 'right')
    // Rows and zones: the left player's end at the centre, the right player's start there.
    const justify = (panel: typeof left, id: string) => panel.getByTestId(id).first().evaluate((el) => getComputedStyle(el).justifyContent)
    expect(await justify(left, 'row-cards')).toBe('flex-end')
    expect(await justify(left, 'player-zones')).toBe('flex-end')
    expect(await justify(right, 'row-cards')).not.toBe('flex-end')
    // The left player's last land ends near the panel's right edge (layout boxes, not the tapped rotation).
    const gap = await left.getByTestId('row-cards').last().evaluate((row) => {
      const last = row.lastElementChild as HTMLElement
      return row.clientWidth - (last.offsetLeft - row.offsetLeft + last.offsetWidth)
    })
    expect(gap).toBeLessThan(20)
    // Life: right of the name on the left, left of the name on the right.
    const x = async (panel: typeof left, id: string) => (await panel.getByTestId(id).boundingBox())!.x
    expect(await x(left, 'player-life')).toBeGreaterThan(await x(left, 'player-commander'))
    expect(await x(right, 'player-life')).toBeLessThan(await x(right, 'player-commander'))
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(left).not.toHaveAttribute('data-side')
  })
})
