import { expect, test } from '@playwright/test'
import { signUpAndLogIn } from './helpers'
import { openReplay, replayEvents, sidebar } from './sim-helpers'

// Spec 026, AC-9 to AC-13: the events sidebar, stepping by event and turn, and autoplay with its settings.
test.describe('Replay stepping and autoplay', () => {
  test.describe.configure({ timeout: 90_000 })

  test('AC-9, AC-10: the sidebar shows and hides, remembered; events step across turns, Shift steps turns', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a } = await openReplay(page, api)
    const turn = page.getByTestId('replay-turn')
    const events = replayEvents(page)
    const current = sidebar(page).locator('[aria-current="true"]')

    // AC-9: open on a wide screen; the tab hides it, and that is remembered.
    await expect(sidebar(page)).toBeVisible()
    const board = (await page.getByTestId('replay-board').boundingBox())!.x
    await page.getByRole('button', { name: 'Hide events' }).click()
    await expect(sidebar(page)).toBeHidden()
    expect((await page.getByTestId('replay-board').boundingBox())!.x).toBe(board)
    await page.reload()
    await expect(page.getByTestId('replay-turn')).toBeVisible()
    await expect(sidebar(page)).toBeHidden()
    await page.getByRole('button', { name: 'Show events' }).click()
    await expect(sidebar(page)).toBeVisible()

    // AC-10: → steps one event, into the next turn after the last.
    await page.keyboard.press('ArrowRight')
    await expect(current).toHaveText(`${a} has kept a hand of 7 cards`)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(turn).toHaveText(`Turn 1 · ${a}`)
    await expect(events.first()).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(turn).toHaveText('Before the game')
    await expect(events.last()).toHaveAttribute('aria-current', 'true')
    // The sidebar's buttons do the same.
    await sidebar(page).getByRole('button', { name: 'Next event' }).click()
    await expect(turn).toHaveText(`Turn 1 · ${a}`)
    await sidebar(page).getByRole('button', { name: 'Previous event' }).click()
    await expect(turn).toHaveText('Before the game')
    // Shift steps whole turns.
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(page.getByTestId('replay-game-turn')).toHaveText('Game turn 2 of 24')
    await expect(current).toHaveCount(0)
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(page.getByTestId('replay-game-turn')).toHaveText('Game turn 1 of 24')
  })

  test('AC-11, AC-12: Play steps through the game until Pause or the end, at the chosen speed and step', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await openReplay(page, api)
    const play = page.getByTestId('replay-play')
    const gameTurn = page.getByTestId('replay-game-turn')

    // By event: Play, then Pause.
    await page.getByRole('button', { name: 'Very fast' }).click()
    await play.click()
    await expect(play).toHaveAccessibleName('Pause')
    await expect(gameTurn).toHaveText(/Game turn [2-9]/)
    await play.click()
    await expect(play).toHaveAccessibleName('Play')
    const stopped = await gameTurn.textContent()
    await page.waitForTimeout(500)
    await expect(gameTurn).toHaveText(stopped!)

    // A manual step pauses it.
    await play.click()
    await expect(play).toHaveAccessibleName('Pause')
    await page.keyboard.press('ArrowRight')
    await expect(play).toHaveAccessibleName('Play')

    // By turn, to the end, where it stops.
    await page.getByRole('button', { name: 'Turn', exact: true }).click()
    await play.click()
    await expect(gameTurn).toHaveText('Game turn 24 of 24', { timeout: 20_000 })
    await expect(play).toHaveAccessibleName('Play')
  })

  test('AC-12: pause at combat stops when attackers are declared; follow plays only that player\'s turns', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const { a, b } = await openReplay(page, api)
    const play = page.getByTestId('replay-play')
    const turn = page.getByTestId('replay-turn')

    await page.getByRole('button', { name: 'Very fast' }).click()
    await page.getByRole('switch', { name: 'Pause at combat' }).click()
    await play.click()
    await expect(play).toHaveAccessibleName('Play', { timeout: 20_000 })
    await expect(sidebar(page).locator('[aria-current="true"]')).toHaveText(`${a} assigned Llanowar Elves (37) to attack ${b}.`)
    await expect(page.getByTestId('combat-arrow')).toHaveCount(1)
    await page.getByRole('switch', { name: 'Pause at combat' }).click()

    // Follow Piper: autoplay goes only through Piper's turns.
    await page.getByRole('slider', { name: 'Turn' }).focus()
    await page.keyboard.press('Home')
    await expect(turn).toHaveText('Before the game')
    await page.getByRole('combobox', { name: 'Follow' }).click()
    await page.getByRole('option', { name: b }).click()
    await page.getByRole('button', { name: 'Turn', exact: true }).click()
    await page.getByRole('button', { name: 'Slow' }).click()
    const seen = new Set<string>()
    await play.click()
    await expect(async () => {
      seen.add((await turn.textContent())!)
      expect(seen).toContain(`Turn 2 · ${b}`)
    }).toPass({ timeout: 10_000, intervals: [200] })
    await play.click()
    expect([...seen].filter((t) => t !== 'Before the game')).toEqual([`Turn 1 · ${b}`, `Turn 2 · ${b}`])
    // Manual steps still go everywhere.
    await page.keyboard.press('Shift+ArrowRight')
    await expect(turn).toHaveText(`Turn 3 · ${a}`)
  })

  test('AC-13: the settings are remembered', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await openReplay(page, api)
    await page.getByRole('button', { name: 'Fast', exact: true }).click()
    await page.getByRole('button', { name: 'Turn', exact: true }).click()
    await page.getByRole('switch', { name: 'Pause at combat' }).click()
    await page.getByRole('switch', { name: 'Show deaths on the board' }).click()
    await page.getByRole('switch', { name: 'Highlight new graveyard cards' }).click()
    await page.getByRole('combobox', { name: 'Follow' }).click()
    await page.getByRole('option').nth(1).click()
    await page.reload()
    await expect(page.getByTestId('replay-turn')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fast', exact: true })).toHaveAttribute('data-state', 'on')
    await expect(page.getByRole('button', { name: 'Turn', exact: true })).toHaveAttribute('data-state', 'on')
    await expect(page.getByRole('switch', { name: 'Pause at combat' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('switch', { name: 'Show deaths on the board' })).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('switch', { name: 'Highlight new graveyard cards' })).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('combobox', { name: 'Follow' })).toContainText('Replay Krenko')
  })
})
