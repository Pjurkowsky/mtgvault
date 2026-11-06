import { expect, test } from '@playwright/test'
import { apiAs, createUser, locationTile, more, signUpAndLogIn, tile, uniqueUser } from './helpers'

test.describe('Public locations and directory', () => {
  const owner = uniqueUser('pub', 'EUR')
  let publicId = 0
  let privateId = 0

  test.beforeAll(async ({ request }) => {
    await createUser(request, owner)
    const api = await apiAs(request, owner)
    const existing = (await api.get('/api/locations/')).locations as { id: number; name: string }[]
    if (existing.length) {
      publicId = existing.find((l) => l.name === 'Showcase')!.id
      privateId = existing.find((l) => l.name === 'Secret Stash')!.id
      return
    }
    publicId = await api.location('Showcase', 'binder', true)
    privateId = await api.location('Secret Stash', 'box', false)
    await api.importList('2 Sol Ring (C21) 263\n1 Lightning Bolt (MSC) 806', publicId, { purchase_price: 99, purchase_currency: 'EUR' })
    await api.importList('1 Rhystic Study (FCA) 31', privateId)
  })

  test('AC-54: the directory lists users with a public location, for anyone', async ({ page }) => {
    await page.goto('/users')
    await page.getByLabel('Search users').fill(owner.username)
    await expect(page.getByTestId('directory')).toContainText(owner.username)
    await expect(page.getByTestId('directory')).toContainText('1 public location')
  })

  test('AC-55, AC-58: the profile lists public locations with totals; visitors see USD', async ({ page }) => {
    await page.goto(`/u/${owner.username}`)
    await expect(locationTile(page, 'Showcase')).toBeVisible()
    await expect(locationTile(page, 'Secret Stash')).toHaveCount(0)
    await expect(locationTile(page, 'Showcase').getByTestId('location-count')).toHaveText('3 cards')
    // 2 × $1.84 + $0.88
    await expect(locationTile(page, 'Showcase').getByTestId('location-value')).toHaveText('$4.56')
  })

  test('AC-58: logged-in visitors see their own currency', async ({ page, request }) => {
    await signUpAndLogIn(page, request, uniqueUser('vis', 'PLN'))
    await page.goto(`/u/${owner.username}`)
    // Each copy converts and rounds first, like the prices shown: 2 × PLN 4.00 + PLN 8.40
    await expect(locationTile(page, 'Showcase').getByTestId('location-value')).toHaveText('PLN 16.40')
  })

  test('AC-56, AC-57: the public page is read-only and hides purchase prices', async ({ page }) => {
    const responses: string[] = []
    page.on('response', async (r) => r.url().includes(`/locations/${publicId}/items/`) && responses.push(await r.text()))
    await page.goto(`/u/${owner.username}`)
    await locationTile(page, 'Showcase').getByRole('link').click()
    await expect(page.getByTestId('location-name')).toHaveText('Showcase')
    await page.getByLabel('Grid view').click() // binders open in binder view (spec 007)
    await expect(page.getByTestId('location-totals')).toContainText('3 cards')
    await expect(page.getByTestId('browser-summary')).toHaveCount(0) // totals show once (spec 009, AC-3)
    await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
    await expect(page.getByTestId('select-all')).toHaveCount(0)
    await expect(page.getByTestId('card-checkbox')).toHaveCount(0)
    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('menuitem', { name: 'Import' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByLabel('Search cards').fill('sol')
    await expect(page.getByTestId('card-tile')).toHaveCount(1)

    await tile(page, 'Sol Ring').click()
    const detail = page.getByTestId('card-detail')
    await expect(detail).toContainText('Near Mint')
    await expect(detail).not.toContainText('Purchase price')
    await expect(detail).not.toContainText('99')
    await expect(detail.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: 'Delete' })).toHaveCount(0)

    expect(responses.length).toBeGreaterThan(0)
    for (const body of responses) {
      expect(body).not.toMatch(/purchase|added_/)
    }
  })

  test('AC-56: visitors can export a public location', async ({ page }) => {
    await page.goto(`/u/${owner.username}/locations/${publicId}`)
    await more(page, 'Export')
    await expect(page.getByTestId('export-text')).toHaveValue('1 Lightning Bolt (MSC) 806\n2 Sol Ring (C21) 263\n')
  })

  test('AC-59: a private location looks exactly like a missing one', async ({ page, request }) => {
    await page.goto(`/u/${owner.username}/locations/${privateId}`)
    await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
    const priv = await request.get(`/api/users/${owner.username}/locations/${privateId}/items/`)
    const missing = await request.get(`/api/users/${owner.username}/locations/999999/items/`)
    expect(priv.status()).toBe(404)
    expect(await priv.text()).toBe(await missing.text())
  })
})

test('AC-60: making a location private removes it from the profile and directory', async ({ page, request }) => {
  const { user, api } = await signUpAndLogIn(page, request)
  const id = await api.location('Briefly Public', 'binder', true)
  await page.goto('/users')
  await page.getByLabel('Search users').fill(user.username)
  await expect(page.getByTestId('directory')).toContainText(user.username)

  await api.patch(`/api/locations/${id}/`, { is_public: false })
  await page.reload()
  await page.getByLabel('Search users').fill(user.username)
  await expect(page.getByText('No public collections match.')).toBeVisible()
  await page.goto(`/u/${user.username}`)
  await expect(page.getByTestId('profile-username')).toBeVisible()
  await expect(locationTile(page, 'Briefly Public')).toHaveCount(0)
})
