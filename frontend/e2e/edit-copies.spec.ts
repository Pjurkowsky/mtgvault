import { expect, test, type Page } from '@playwright/test'
import { binderSlot, choose, signUpAndLogIn, tile } from './helpers'

// Spec 018: editing one copy leaves its twins alone (AC-1 to AC-4).
type Row = { id: number; quantity: number; finish: string; condition: string }
const rows = async (api: { get: (p: string) => Promise<{ results: Row[] }> }, query: string) =>
  (await api.get(`/api/items/?${query}`)).results.map((r) => [r.finish, r.condition, r.quantity]).sort()

async function binderWithTwins(api: Awaited<ReturnType<typeof signUpAndLogIn>>['api'], quantity: number) {
  const binder = await api.location('Trades')
  await api.importList(`${quantity} Lightning Bolt (MSC) 806`, binder)
  const item = (await api.get(`/api/locations/${binder}/binder/`)).unplaced?.[0]?.id
    ?? (await api.get(`/api/items/?location=${binder}`)).results[0].id
  for (let col = 1; col <= quantity; col++) {
    await api.post(`/api/locations/${binder}/binder/move/`, { item, to: { page: 1, row: 1, col } })
  }
  return binder
}

const pressFinish = (page: Page, name: string) =>
  page.getByTestId('edit-dialog').getByRole('group', { name: 'Finish' }).getByRole('button', { name, exact: true }).click()

test.describe('Edit single copies', () => {
  test('AC-1, AC-4: editing a binder pocket changes only its copy', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await binderWithTwins(api, 2)
    await api.patch(`/api/items/${(await api.get(`/api/items/?location=${binder}`)).results[0].id}/`, { purchase_price: 2, purchase_currency: 'EUR' })
    await page.goto(`/locations/${binder}`)
    await binderSlot(page, 1, 1).getByRole('button', { name: 'Lightning Bolt' }).first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const dialog = page.getByTestId('edit-dialog')
    await expect(dialog.getByLabel('Quantity')).toHaveCount(0)
    await expect(dialog.getByTestId('edit-copies')).toHaveCount(0)
    await pressFinish(page, 'Foil')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    expect(await rows(api, `location=${binder}`)).toEqual([['foil', 'NM', 1], ['nonfoil', 'NM', 1]])
    const items = (await api.get(`/api/items/?location=${binder}`)).results as (Row & { purchase_price: string })[]
    expect(items.map((i) => Number(i.purchase_price))).toEqual([2, 2]) // AC-4
    const slots = (await api.get(`/api/locations/${binder}/binder/`)).slots as { item: number; col: number }[]
    const foil = items.find((i) => i.finish === 'foil')!
    expect(slots.map((s) => [s.col, s.item === foil.id]).sort()).toEqual([[1, true], [2, false]])
  })

  test('AC-3: delete from a pocket removes one copy', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const binder = await binderWithTwins(api, 3)
    await page.goto(`/locations/${binder}`)
    await binderSlot(page, 1, 2).getByRole('button', { name: 'Lightning Bolt' }).first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('This removes 1 card from your collection.')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(binderSlot(page, 1, 2)).toHaveAttribute('data-state', 'empty')
    await expect(binderSlot(page, 1, 1)).toHaveAttribute('data-state', 'filled')
    expect(await rows(api, `location=${binder}`)).toEqual([['nonfoil', 'NM', 2]])
  })

  test('AC-2: the collection Edit changes N of M copies; a match merges; identical copies are refused', async ({ page, request }) => {
    const { user, api } = await signUpAndLogIn(page, request)
    await api.importList('3 Lightning Bolt (MSC) 806')
    await page.goto('/cards')
    const edit = async () => {
      await tile(page, 'Lightning Bolt').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Edit' }).click()
    }
    const dialog = page.getByTestId('edit-dialog')

    await edit()
    await expect(dialog.getByLabel('Change')).toHaveValue('3')
    await expect(dialog.getByLabel('Quantity')).toBeVisible()
    await dialog.getByLabel('Change').fill('1')
    await expect(dialog.getByLabel('Quantity')).toHaveCount(0)
    await choose(page, 'Condition', 'Lightly Played')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    expect(await rows(api, '')).toEqual([['nonfoil', 'LP', 1], ['nonfoil', 'NM', 2]])

    // The split copy matches the LP row: they merge.
    const nm = (await api.get('/api/items/')).results.find((r: Row) => r.condition === 'NM')
    expect((await api.patch(`/api/items/${nm.id}/`, { copies: 1, condition: 'LP' })).merged).toBe(true)
    expect(await rows(api, '')).toEqual([['nonfoil', 'LP', 2], ['nonfoil', 'NM', 1]])

    // Only a purchase price on some copies: identical copies share one row.
    const lp = (await api.get('/api/items/')).results.find((r: Row) => r.condition === 'LP')
    const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
    const refused = await request.patch(`/api/items/${lp.id}/`, {
      headers: { Authorization: `Bearer ${(await login.json()).access}` }, data: { copies: 1, purchase_price: 5 },
    })
    expect(refused.status()).toBe(400)
    expect((await refused.json()).copies[0]).toContain('Identical copies share one row')
  })
})
