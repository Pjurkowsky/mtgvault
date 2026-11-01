import { expect, test } from '@playwright/test'
import { choose, locationTile, signUpAndLogIn, tile } from './helpers'

test.describe('Locations', () => {
  test('AC-7, AC-10: create a private location, then rename, change kind and make it public', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await page.getByRole('button', { name: 'New location' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Blue Binder')
    await expect(dialog.getByRole('radio', { name: 'Binder' })).toBeChecked()
    await expect(dialog.getByRole('switch', { name: 'Public' })).not.toBeChecked()
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(locationTile(page, 'Blue Binder')).toBeVisible()
    await expect(locationTile(page, 'Blue Binder').getByLabel('Public')).toHaveCount(0)

    await page.getByRole('button', { name: 'Blue Binder options' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await dialog.getByLabel('Name').fill('Blue Box')
    await dialog.getByRole('radio', { name: 'Box', exact: true }).click()
    await dialog.getByRole('switch', { name: 'Public' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    const renamed = locationTile(page, 'Blue Box')
    await expect(renamed.getByLabel('Box', { exact: true })).toBeVisible()
    await expect(renamed.getByLabel('Public')).toBeVisible()
  })

  test('AC-8: names are unique per user, ignoring case', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    await api.location('Trade Binder')
    await page.reload()
    await page.getByRole('button', { name: 'New location' }).click()
    await page.getByRole('dialog').getByLabel('Name').fill('TRADE binder')
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('You already have a location with this name.')).toBeVisible()
  })

  test('AC-9: tiles show kind, card count and value, plus Unfiled', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const box = await api.location('Bulk', 'box')
    await api.importList('2 Sol Ring (C21) 263', box)
    await api.importList('3 Sol Ring (C21) 263')
    await page.reload()
    const bulk = locationTile(page, 'Bulk')
    await expect(bulk.getByLabel('Box')).toBeVisible()
    await expect(bulk.getByTestId('location-count')).toHaveText('2 cards')
    await expect(bulk.getByTestId('location-value')).toHaveText('€1.82')
    await expect(locationTile(page, 'Unfiled').getByTestId('location-count')).toHaveText('3 cards')
  })

  test('AC-11: deleting a location asks what happens to its cards', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const a = await api.location('Alpha')
    await api.location('Beta')
    const c = await api.location('Gamma')
    await api.location('Empty')
    await api.importList('2 Sol Ring (C21) 263', a)
    await api.importList('1 Forest (M21) 272', c)
    await page.reload()
    const dialog = page.getByRole('alertdialog')

    // Move to another location
    await page.getByRole('button', { name: 'Alpha options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(dialog).toContainText('It holds 2 cards.')
    await dialog.getByRole('radio', { name: 'Move them to' }).click()
    await choose(page, 'Target location', 'Beta')
    await dialog.getByRole('button', { name: 'Delete location' }).click()
    await expect(locationTile(page, 'Alpha')).toHaveCount(0)
    await expect(locationTile(page, 'Beta').getByTestId('location-count')).toHaveText('2 cards')

    // Delete the cards too
    await page.getByRole('button', { name: 'Gamma options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await dialog.getByRole('radio', { name: 'Delete them too' }).click()
    await dialog.getByRole('button', { name: 'Delete location' }).click()
    await expect(locationTile(page, 'Gamma')).toHaveCount(0)
    await expect(locationTile(page, 'Unfiled').getByTestId('location-count')).toHaveText('0 cards')

    // Make them Unfiled (the default)
    await page.getByRole('button', { name: 'Beta options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await dialog.getByRole('button', { name: 'Delete location' }).click()
    await expect(locationTile(page, 'Unfiled').getByTestId('location-count')).toHaveText('2 cards')

    // An empty location only needs a confirm
    await page.getByRole('button', { name: 'Empty options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Delete location' }).click()
    await expect(locationTile(page, 'Empty')).toHaveCount(0)
  })

  test('AC-12: Unfiled cannot be edited, deleted or made public', async ({ page, request }) => {
    await signUpAndLogIn(page, request)
    await expect(locationTile(page, 'Unfiled')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unfiled options' })).toHaveCount(0)
    await locationTile(page, 'Unfiled').getByRole('link').click()
    await expect(page.getByTestId('location-name')).toHaveText('Unfiled')
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  })

  test('AC-13: a location page shows its name, kind, totals and only its cards', async ({ page, request }) => {
    const { api } = await signUpAndLogIn(page, request)
    const deck = await api.location('Mono Red', 'deck_box')
    await api.importList('4 Lightning Bolt (MSC) 806', deck)
    await api.importList('1 Sol Ring (C21) 263')
    await page.reload()
    await locationTile(page, 'Mono Red').getByRole('link').click()
    await expect(page.getByTestId('location-name')).toHaveText('Mono Red')
    await expect(page.getByTestId('location-kind')).toHaveText('Deck box')
    await expect(page.getByTestId('location-totals')).toHaveText('4 cards · €7.64')
    await expect(tile(page, 'Lightning Bolt')).toBeVisible()
    await expect(tile(page, 'Sol Ring')).toHaveCount(0)
  })
})
