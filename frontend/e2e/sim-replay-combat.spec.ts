import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'
import { openReplay, replayEvents, replayPlayer, turnsAhead } from './sim-helpers'

// Spec 026, AC-6 to AC-8: combat arrows, deaths on the board and new graveyard cards. Game turn 3 of the
// recording: Krenko's Llanowar Elves (37) attacks Piper, Piper's Llanowar Elves (141) blocks it and dies.
test.describe('Replay combat', () => {
  test.describe.configure({ timeout: 90_000 })

  test('AC-6: arrows from attackers to the player they attack and from blockers to the attacker, on every screen size', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a, b } = await openReplay(page, api)
    await turnsAhead(page, 3)
    const events = replayEvents(page)
    const arrows = page.getByTestId('combat-arrow')

    await events.first().click()
    await expect(arrows).toHaveCount(0)
    await events.nth(1).click()
    await expect(arrows).toHaveCount(1)
    await expect(arrows.first()).toHaveAttribute('data-kind', 'attack')
    await expect(arrows.first()).toHaveAttribute('data-to', 'seat-1')
    await expect(replayPlayer(page, a).locator('[data-attacking]')).toHaveCount(1)
    // The arrow runs from the attacker towards the other player's panel.
    const line = await arrows.first().evaluate((l) => ({ x1: Number(l.getAttribute('x1')), x2: Number(l.getAttribute('x2')) }))
    expect(line.x2).toBeGreaterThan(line.x1)

    await events.nth(2).click()
    await expect(arrows).toHaveCount(2)
    const block = page.locator('[data-testid="combat-arrow"][data-kind="block"]')
    await expect(block).toHaveAttribute('data-from', '141')
    await expect(block).toHaveAttribute('data-to', 'card-37')
    await expect(replayPlayer(page, b).locator('[data-blocking]')).toHaveCount(1)

    // On a phone too, panel above panel.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(arrows).toHaveCount(2)
    const phone = await arrows.first().evaluate((l) => ({ y1: Number(l.getAttribute('y1')), y2: Number(l.getAttribute('y2')) }))
    expect(phone.y2).toBeGreaterThan(phone.y1)
    // A step after combat has none.
    await page.keyboard.press('Shift+ArrowRight')
    await expect(arrows).toHaveCount(0)
  })

  test('AC-7, AC-8: a creature that died stays as a ghost for that step; new graveyard cards are highlighted; both can be turned off', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { b } = await openReplay(page, api)
    await turnsAhead(page, 3)
    const piper = replayPlayer(page, b)
    const creatures = piper.getByTestId('row-creature')
    const events = replayEvents(page)

    // The step before: alive, nothing new.
    await events.nth(6).click()
    await expect(creatures.getByTestId('board-card')).toHaveCount(1)
    await expect(creatures.getByTestId('board-ghost')).toHaveCount(0)
    await expect(piper.getByTestId('player-graveyard')).not.toHaveAttribute('data-fresh')

    // AC-7: the step it dies, faded with a skull, in its place.
    await events.nth(7).click()
    await expect(events.nth(7)).toHaveText('Llanowar Elves (141) was put into Graveyard from Battlefield.')
    await expect(creatures.getByTestId('board-card')).toHaveCount(0)
    await expect(creatures.getByTestId('board-ghost')).toHaveAccessibleName('Llanowar Elves, died')
    await expect(creatures).toContainText('Creatures 0')
    // AC-8: the graveyard count is marked and the card highlighted in its list.
    await expect(piper.getByTestId('player-graveyard')).toHaveAttribute('data-fresh', '1')
    await piper.getByTestId('player-graveyard').click()
    await expect(page.getByTestId('zone-graveyard-list').locator('[data-fresh]')).toHaveCount(1)
    await page.keyboard.press('Escape')

    // Only for that step.
    await page.keyboard.press('Shift+ArrowRight')
    await expect(creatures.getByTestId('board-ghost')).toHaveCount(0)
    await expect(piper.getByTestId('player-graveyard')).not.toHaveAttribute('data-fresh')

    // Both are settings in the sidebar.
    await page.keyboard.press('Shift+ArrowLeft')
    await events.nth(7).click()
    await expect(creatures.getByTestId('board-ghost')).toHaveCount(1)
    await page.getByRole('switch', { name: 'Show deaths on the board' }).click()
    await expect(creatures.getByTestId('board-ghost')).toHaveCount(0)
    await page.getByRole('switch', { name: 'Highlight new graveyard cards' }).click()
    await expect(piper.getByTestId('player-graveyard')).not.toHaveAttribute('data-fresh')
  })

  test('AC-14, AC-15: card names in events show their card; a ghost says why it died', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { b } = await openReplay(page, api)
    await turnsAhead(page, 3)
    const events = replayEvents(page)

    // AC-14: "<deck> assigned Llanowar Elves (37) to attack <deck>." names one card, not the decks.
    const names = events.nth(1).getByTestId('event-card')
    await expect(names).toHaveText(['Llanowar Elves (37)'])
    await names.first().hover()
    await expect(page.getByTestId('card-preview')).toHaveAccessibleName('Llanowar Elves')
    await names.first().click()
    await expect(page.getByTestId('fullscreen')).toHaveAccessibleName('Llanowar Elves')
    await page.keyboard.press('Escape')
    await expect(events.nth(5).getByTestId('event-card')).toHaveText(['Llanowar Elves (37)', 'Llanowar Elves (141)'])

    // AC-15: the blocker that died, with the last three events naming it.
    await events.nth(7).click()
    await page.mouse.move(0, 0)
    await replayPlayer(page, b).getByTestId('board-ghost').hover()
    await expect(page.getByTestId('death-reason').getByRole('listitem')).toHaveText([
      `${b} assigned Llanowar Elves (141) to block Llanowar Elves (37).`,
      'Llanowar Elves (37) deals 4 damage to Llanowar Elves (141).',
      'Llanowar Elves (141) deals 1 damage to Llanowar Elves (37).',
    ])
  })

  test('AC-19: attacked players show the unblocked damage coming at them', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a, b } = await openReplay(page, api)
    const events = replayEvents(page)
    const incoming = (name: string) => replayPlayer(page, name).getByTestId('player-incoming')
    // Game turn 3: one 1/1 attacks Piper, then gets blocked.
    await turnsAhead(page, 3)
    await events.first().click()
    await expect(incoming(b)).toHaveCount(0)
    await events.nth(1).click()
    await expect(incoming(b)).toHaveText('1')
    await expect(incoming(a)).toHaveCount(0)
    await events.nth(2).click()
    await expect(incoming(b)).toHaveText('0')
    // Game turn 14: three unblocked 4/3s at Krenko.
    await turnsAhead(page, 11)
    await events.nth(1).click()
    await expect(events.nth(1)).toContainText('to attack')
    await expect(incoming(a)).toHaveText('12')
  })
})
