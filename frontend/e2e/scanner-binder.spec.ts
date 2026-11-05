import { expect, test } from '@playwright/test'
import { binderSlot as slot, signUpAndLogIn } from './helpers'

// Spec 007: scanning into a binder in order (AC-20 to AC-23), with the fake camera showing Sol Ring.
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000

type Api = Awaited<ReturnType<typeof signUpAndLogIn>>['api']
async function binderWithBolt(api: Api, settings: Record<string, unknown> = {}) {
  const binder = await api.location('Scanned binder')
  await api.importList('1 Lightning Bolt (FDC) 163', binder)
  const bolt = (await api.get(`/api/locations/${binder}/binder/`)).items[0].id
  await api.post(`/api/locations/${binder}/binder/move/`, { item: bolt, to: { page: 1, row: 1, col: 1 } })
  if (Object.keys(settings).length) await api.patch(`/api/locations/${binder}/binder/`, settings)
  return binder
}
const placed = async (api: Api, binder: number) =>
  ((await api.get(`/api/locations/${binder}/binder/`)).slots as { page: number; row: number; col: number }[])
    .map((s) => `${s.page}-${s.row}-${s.col}`).sort()

test('AC-20 to AC-22: the Scan button logs into the binder in order; Undo frees the slot; the direction changes', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  const binder = await binderWithBolt(api)
  await page.goto(`/locations/${binder}`)
  await page.getByRole('button', { name: 'Scan cards' }).click()
  await expect(page).toHaveURL(new RegExp(`/scan\\?location=${binder}$`))
  await expect(page.getByTestId('scan-destination')).toHaveText('Scanned binder')
  await expect(page.getByTestId('binder-cursor')).toHaveText('Page 1 · slot 2 →') // the first empty slot

  await expect(page.getByTestId('result-slot')).toHaveText('Page 1 · slot 2', { timeout: LOG_TIMEOUT })
  await expect(page.getByTestId('binder-cursor')).toHaveText('Page 1 · slot 3 →')
  expect(await placed(api, binder)).toEqual(['1-1-1', '1-1-2'])

  // Undo frees slot 2 and the cursor steps back; the card in view logs there again.
  await page.getByTestId('result-bar').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('result-bar')).toBeHidden()
  await expect(page.getByTestId('result-slot')).toHaveText('Page 1 · slot 2', { timeout: LOG_TIMEOUT })
  expect(await placed(api, binder)).toEqual(['1-1-1', '1-1-2'])
  expect((await api.get(`/api/items/?location=${binder}`)).total_quantity).toBe(2)

  // Down columns from slot 1: slot 1 is taken, so slot 4 (row 2, column 1).
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  const dialog = page.getByTestId('binder-scan')
  await dialog.getByLabel('Slot').fill('1')
  await dialog.getByRole('radio', { name: 'Down columns' }).click()
  await dialog.getByRole('button', { name: 'Use' }).click()
  await expect(page.getByTestId('binder-cursor')).toHaveText('Page 1 · slot 1 ↓')
  await expect(page.getByTestId('result-slot')).toHaveText('Page 1 · slot 4', { timeout: LOG_TIMEOUT })
  expect(await placed(api, binder)).toEqual(['1-1-1', '1-1-2', '1-2-1'])

  await page.getByRole('button', { name: 'Close scanner' }).click()
  await expect(page).toHaveURL(new RegExp(`/locations/${binder}$`))
})

test('AC-21, AC-23: Scan from here starts at that slot; a full binder warns and sends cards to Unplaced', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  const binder = await binderWithBolt(api, { rows: 2, cols: 2, pages: 1 })
  await page.goto(`/locations/${binder}`)
  await slot(page, 1, 4, 2).getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Scan from here' }).click()
  await expect(page).toHaveURL(new RegExp(`/scan\\?location=${binder}&page=1&row=2&col=2$`))
  await expect(page.getByTestId('binder-cursor')).toHaveText('Page 1 · slot 4 →')
  await expect(page.getByTestId('result-slot')).toHaveText('Page 1 · slot 4', { timeout: LOG_TIMEOUT })

  // Past the last slot of the only page: full.
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  await page.getByTestId('binder-scan').getByRole('button', { name: 'Use' }).click()
  await expect(page.getByTestId('binder-full')).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect(page.getByTestId('result-slot')).toHaveCount(0)
  const state = await api.get(`/api/locations/${binder}/binder/`)
  expect(state.unplaced).toHaveLength(1)
})
