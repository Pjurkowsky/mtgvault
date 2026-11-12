import { expect, test, type Page } from '@playwright/test'
import { logOut, signUpAndLogIn } from './helpers'
import { PIPER, commanderDeck, openRun, runCard, startRun, waitForRun } from './sim-helpers'

// Spec 024, AC-23 to AC-28: a finished game, turn by turn, at /simulations/:run/games/:n since spec 025 (AC-9). The fake Forge replays a recorded
// 2-player game (24 game turns; the second seat wins on its turn 12; recorded again for spec 026) and a 4-player one.
// Spec 026 moved the events into a sidebar (AC-9), arrow keys to events with Shift for turns (AC-10), and piles into image dialogs (AC-2).
const player = (page: Page, name: string) => page.getByTestId('replay-player').filter({ has: page.getByText(name, { exact: true }) })
const columns = (page: Page) => page.getByTestId('replay-board').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)

test.describe('Replay', () => {
  test.describe.configure({ timeout: 90_000 })

  test('AC-23 to AC-25, AC-27, AC-28: turns, panels, events, the log, and a link to share', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const a = `Replay Krenko ${stamp}`
    const b = `Replay Piper ${stamp}`
    const deck = await commanderDeck(api, a, undefined, { is_public: true })
    const piper = await commanderDeck(api, b, PIPER)
    const run = await startRun(api, deck.id, [{ deck: piper.id }], { games: 1 })
    await waitForRun(api, run.id)

    // AC-23: from the game list to its own page.
    await openRun(page, run.id)
    await runCard(page).getByRole('link', { name: 'Replay' }).click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${run.id}/games/1$`))
    await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible()
    await expect(page.getByTestId('game-result')).toHaveText(`${b} won on turn 12`)

    // AC-24: buttons, Shift + arrow keys (spec 026 AC-10) and the slider step through turns.
    const turn = page.getByTestId('replay-turn')
    await expect(turn).toHaveText('Before the game')
    await page.getByRole('button', { name: 'Next turn' }).click()
    await expect(turn).toHaveText(`Turn 1 · ${a}`)
    await expect(page.getByTestId('replay-game-turn')).toHaveText('Game turn 1 of 24')
    await expect(player(page, a)).toHaveAttribute('data-active', 'true')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(turn).toHaveText(`Turn 1 · ${b}`)
    await expect(player(page, b)).toHaveAttribute('data-active', 'true')
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(turn).toHaveText(`Turn 1 · ${a}`)

    // AC-27: a turn's events; clicking one shows the board then (game turn 3: a land, an attack, then the blocker dies).
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(turn).toHaveText(`Turn 2 · ${a}`)
    const events = page.getByRole('complementary', { name: 'Events' }).getByTestId('replay-event')
    await expect(events.first()).toHaveText(`${a} played Forest (72)`)
    await expect(events.nth(1)).toHaveText(`${a} assigned Llanowar Elves (37) to attack ${b}.`)
    const blocker = player(page, b).getByTestId('row-creature').getByTestId('board-card')
    await expect(blocker).toHaveCount(0)
    await events.first().click()
    await expect(events.first()).toHaveAttribute('aria-current', 'true')
    await expect(blocker).toHaveCount(1)

    // AC-25: the last turn: life, rows, tapped cards, P/T, piles, hand and library, the loser dimmed.
    await page.getByRole('slider', { name: 'Turn' }).focus()
    await page.keyboard.press('End')
    await expect(page.getByTestId('replay-game-turn')).toHaveText('Game turn 24 of 24')
    const loser = player(page, a)
    await expect(loser).toHaveAttribute('data-lost', 'true')
    await expect(loser.getByTestId('player-lost')).toHaveText('Lost on turn 12')
    await expect(loser.getByTestId('player-life')).toHaveText('-12')
    expect(await loser.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1)
    const winner = player(page, b)
    await expect(winner.getByTestId('player-life')).toHaveText('22')
    await expect(winner.getByTestId('player-hand')).toHaveText('Hand 0')
    await expect(winner.getByTestId('player-library')).toHaveText('Library 80')
    await expect(winner.getByTestId('board-card')).toHaveCount(16)
    await expect(winner.locator('[data-tapped]')).toHaveCount(7)
    await expect(winner.getByTestId('row-creature').getByTestId('board-pt').first()).toHaveText(/\d+\/\d+/)
    await expect(winner.getByTestId('row-land').getByRole('img', { name: 'Forest' }).first()).toHaveAttribute('src', /scryfall/)
    await loser.getByTestId('player-graveyard').click()
    expect(await page.getByTestId('zone-graveyard-list').getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual([
      'Giant Growth', 'Giant Growth', 'Temur Sabertooth', 'Temur Sabertooth', 'Llanowar Elves', 'Temur Sabertooth', 'Llanowar Elves', 'Llanowar Elves', 'Llanowar Elves',
    ])
    await page.keyboard.press('Escape')
    // Hovering a card shows it large.
    await winner.getByTestId('row-creature').getByTestId('board-card').first().hover()
    await expect(page.getByRole('img', { name: 'Llanowar Elves' }).last()).toBeVisible()

    // AC-28: the full log.
    await page.getByRole('tab', { name: 'Log' }).click()
    await expect(page.getByTestId('replay-log')).toContainText(`Mulligan: ${a} has kept a hand of 7 cards`)
    await expect(page.getByTestId('replay-log')).toContainText(`Turn: Turn 20 (${b})`)

    // Spec 025 AC-9: Back returns to the run; the old deck links are gone. AC-1: visitors log in first.
    await page.getByRole('link', { name: a }).click()
    await expect(page).toHaveURL(new RegExp(`/simulations/${run.id}$`))
    await expect(runCard(page)).toBeVisible()
    await page.goto(`/decks/${deck.id}/simulations/${run.id}/games/1`)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await logOut(page)
    await page.goto(`/simulations/${run.id}/games/1`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC-26, AC-27: two columns up to four players, three for five or six, one on a phone with the events sidebar', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const stamp = Date.now()
    const deck = await commanderDeck(api, `Table ${stamp}`)
    const others = await Promise.all([1, 2, 3, 4].map((i) => commanderDeck(api, `Table ${i} ${stamp}`, PIPER)))
    const four = await startRun(api, deck.id, others.slice(0, 3).map((d) => ({ deck: d.id })), { games: 1 })
    const five = await startRun(api, deck.id, others.map((d) => ({ deck: d.id })), { games: 1 })
    await waitForRun(api, four.id)
    await waitForRun(api, five.id)

    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto(`/simulations/${four.id}/games/1`)
    await expect(page.getByTestId('replay-player')).toHaveCount(4)
    expect(await columns(page)).toBe(2)
    await page.goto(`/simulations/${five.id}/games/1`)
    await expect(page.getByTestId('replay-player')).toHaveCount(5)
    expect(await columns(page)).toBe(3)

    // Spec 026 AC-17: two +1/+1 counters read +2/+2 (game turn 29: Prosperous Bandit).
    for (let i = 0; i < 29; i++) await page.keyboard.press('Shift+ArrowRight')
    await expect(page.getByTestId('replay-game-turn')).toHaveText(/Game turn 29 of/)
    await expect(page.getByTestId('board-card').filter({ hasText: '+2/+2' }).first()).toBeVisible()
    await expect(page.getByTestId('board-counter').filter({ hasText: /^2 \+1/ })).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    expect(await columns(page)).toBe(1)
    // Spec 026 AC-9: the sidebar replaces the drawer.
    await page.getByRole('button', { name: 'Hide events' }).click()
    await expect(page.getByRole('complementary', { name: 'Events' })).toBeHidden()
    await page.getByRole('button', { name: 'Next turn' }).click()
    await page.getByRole('button', { name: 'Show events' }).click()
    await expect(page.getByRole('complementary', { name: 'Events' }).getByTestId('replay-event').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
