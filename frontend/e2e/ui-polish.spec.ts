import { expect, test, type Page } from '@playwright/test'
import { binderSlot, deckRow, signUpAndLogIn } from './helpers'

// Spec 023: UI polish. Krenko makes a Goblin; Dockside and Smothering Tithe make a Treasure.
const LIST = 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Dockside Extortionist\n1 Sol Ring\n\nMaybeboard\n1 Smothering Tithe'
const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!
const slotWidth = async (page: Page) => (await binderSlot(page, 2, 1).boundingBox())!.width

test.describe('UI polish', () => {
  test('AC-1, AC-2: the toolbar is one left block; the keys show on the search box', async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Toolbar', 'commander', { text: LIST })
    await page.goto(`/decks/${deck.id}`)

    // The view toggle sits right after the other controls, far from the right edge.
    const toolbar = await box(page, 'deck-toolbar')
    const toggle = (await page.getByRole('button', { name: 'Card images' }).boundingBox())!
    expect(toolbar.x + toolbar.width - (toggle.x + toggle.width)).toBeGreaterThan(200)

    await expect(page.getByTestId('deck-toolbar').getByRole('button', { name: /Escape clears/ })).toHaveCount(0) // no ⓘ icon
    await page.getByTestId('deck-search').hover()
    await expect(page.getByTestId('search-keys')).toContainText('Escape')
    await page.mouse.move(0, 0)
    await expect(page.getByTestId('search-keys')).toHaveCount(0)
    await page.getByTestId('deck-search').locator('input').focus()
    await expect(page.getByTestId('search-keys')).toBeVisible()
  })

  test('AC-3: tokens are a group after Maybeboard in every view, names only', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Tokens', 'casual', { text: 'Deck\n1 Dockside Extortionist\n1 Sol Ring\n\nMaybeboard\n1 Krenko, Mob Boss' })

    for (const layout of ['text', 'list', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      const tokens = page.getByTestId('deck-tokens')
      await expect(tokens.getByRole('heading')).toHaveText('Tokens (1)')
      // Inside the view's own column flow, after Maybeboard.
      await expect(page.getByTestId(`deck-${layout}`).getByTestId('deck-tokens')).toHaveCount(1)
      const groups = await page.getByTestId(`deck-${layout}`).locator(':scope > section').evaluateAll((s) => s.map((e) => e.getAttribute('data-testid')))
      expect(groups.at(-1)).toBe('deck-tokens')
      expect(groups.at(-2)).toBe('group-maybe')
      if (layout !== 'visual') await expect(tokens.getByTestId('token-row')).toHaveText('Treasure')
    }

    await page.getByTestId('deck-tokens').getByRole('button', { name: 'Treasure' }).click()
    await expect(page.getByTestId('token-makers')).toContainText('Dockside Extortionist')
  })

  test('AC-4: List view lists the commander first; the side column only previews', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.deck('Krenko', 'commander', { text: LIST })

    await page.goto(`/decks/${deck.id}?layout=list`)
    const groups = page.getByTestId('deck-list').locator(':scope > section')
    await expect(groups.first()).toHaveAttribute('data-testid', 'group-commander')
    await expect(groups.first().getByRole('heading')).toContainText('Commander (1)')
    await expect(groups.first()).toContainText('Krenko, Mob Boss')
    await expect(page.getByTestId('deck-commander')).toHaveCount(0)
    await deckRow(page, 'Sol Ring').hover()
    await expect(page.getByTestId('deck-preview')).toHaveAttribute('alt', 'Sol Ring')

    for (const layout of ['text', 'visual']) {
      await page.goto(`/decks/${deck.id}?layout=${layout}`)
      await expect(page.getByTestId('deck-commander').getByRole('button', { name: 'Krenko, Mob Boss' })).toBeVisible()
      await expect(page.getByTestId('group-commander')).toHaveCount(0)
    }
  })

  test('AC-5, AC-6: tiles have a max width, wider windows get more columns; deck tiles show tall art', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    for (const n of [1, 2, 3, 4, 5]) await api.location(`Binder ${n}`)
    for (const n of [1, 2, 3, 4, 5, 6]) await api.deck(`Deck ${n}`, 'commander', { text: 'Commander\n1 Krenko, Mob Boss' })

    const columns = async (tiles: string) => new Set(await page.getByTestId(tiles).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))).size
    for (const [width, locations, decks] of [[1280, 3, 4], [1920, 5, 6]] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.getByTestId('location-tile')).not.toHaveCount(0)
      for (const tile of await page.getByTestId('location-tile').all()) expect((await tile.boundingBox())!.width).toBeLessThanOrEqual(320)
      expect(await columns('location-tile')).toBeGreaterThanOrEqual(locations)

      await page.goto('/decks')
      await expect(page.getByTestId('deck-tile')).toHaveCount(6)
      for (const tile of await page.getByTestId('deck-tile').all()) expect((await tile.boundingBox())!.width).toBeLessThanOrEqual(256)
      expect(await columns('deck-tile')).toBeGreaterThanOrEqual(decks)
    }
    const art = (await page.getByTestId('deck-tile').first().locator('img').boundingBox())!
    expect(art.height).toBeGreaterThanOrEqual(180)
  })

  test('AC-7, AC-8: S, M, L only; pockets shrink so the pages fit the window; a saved Fit falls back to M', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Sizes')
    await api.importList('1 Sol Ring (C21) 263', binder)
    const item = (await api.get(`/api/locations/${binder}/binder/`)).items[0].id
    await api.post(`/api/locations/${binder}/binder/move/`, { item, to: { page: 3, row: 1, col: 1 } })

    await page.addInitScript(() => localStorage.getItem('mtgvault.binder.size') ?? localStorage.setItem('mtgvault.binder.size', 'fit'))
    await page.goto(`/locations/${binder}?page=2`)
    const toggle = page.getByRole('group', { name: 'Card size' })
    await expect(toggle.getByRole('button')).toHaveText(['S', 'M', 'L'])
    await expect(toggle.getByRole('button', { name: 'Medium cards' })).toHaveAttribute('data-state', 'on')

    const pocket = () => slotWidth(page)
    await toggle.getByRole('button', { name: 'Large cards' }).click()
    await expect(page.getByTestId('binder-page')).toHaveCount(2)
    await expect.poll(pocket).toBeLessThan(152) // L is capped by the window height
    const noScroll = () => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)
    await expect.poll(noScroll).toBe(true)
    const pagination = (await page.getByTestId('binder-pagination').boundingBox())!
    expect(pagination.y + pagination.height).toBeLessThanOrEqual(900)

    // A taller window lets L reach its size, never more.
    await page.setViewportSize({ width: 1800, height: 1600 })
    await expect.poll(pocket).toBe(152)
    await toggle.getByRole('button', { name: 'Small cards' }).click()
    await expect.poll(pocket).toBe(80)

    // Phones keep one full-width page and scroll.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('binder-page')).toHaveCount(1)
    expect((await page.getByTestId('binder-page').boundingBox())!.x + (await page.getByTestId('binder-page').boundingBox())!.width).toBeLessThanOrEqual(390)
  })

  test('AC-9: the slots count sits in the binder header after the card count and value', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Header', 'binder', true)
    await api.patch(`/api/locations/${binder}/binder/`, { pages: 8 }) // 3 × 3 × 8 = 72
    await api.importList('1 Sol Ring (C21) 263', binder)
    await page.goto(`/locations/${binder}`)
    const used = page.getByTestId('binder-used')
    await expect(used).toHaveText('0 / 72 slots') // imported cards arrive unplaced
    const totals = (await page.getByTestId('location-totals').boundingBox())!
    const box = (await used.boundingBox())!
    expect(Math.abs(box.y - totals.y)).toBeLessThan(8)
    expect(box.x).toBeGreaterThan(totals.x + totals.width - 1)
    expect(box.y).toBeLessThan((await page.getByTestId('binder-page').first().boundingBox())!.y)
  })
})
