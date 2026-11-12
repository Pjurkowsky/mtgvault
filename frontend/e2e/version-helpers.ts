import { expect, type Page } from '@playwright/test'

// Spec 027: the versions panel on the deck page.
export const panel = (page: Page) => page.getByTestId('versions-panel')
export const branchRow = (page: Page, name: string) =>
  page.getByTestId('branch').filter({ has: page.getByTestId('branch-name').getByText(name, { exact: true }) })
export const versionRow = (page: Page, number: number) =>
  page.getByTestId('version').filter({ has: page.getByTestId('version-number').getByText(`v${number}`, { exact: true }) })

/** Open the panel; it starts closed (AC-1). */
export async function showVersions(page: Page) {
  await page.getByRole('button', { name: 'Show versions' }).click()
  await expect(panel(page)).toHaveAttribute('data-state', 'open')
}

/** Close the panel: it lies over the header's buttons. */
export async function hideVersions(page: Page) {
  await page.getByRole('button', { name: 'Hide versions' }).click()
  await expect(panel(page)).toHaveAttribute('data-state', 'closed')
}

/** A branch's ⋯ menu item. */
export async function branchMenu(page: Page, name: string, item: 'Rename' | 'Make Main' | 'Delete') {
  const row = branchRow(page, name)
  await row.hover()
  await row.getByTestId('branch-menu').click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** A version's ⋯ menu item. */
export async function versionMenu(page: Page, number: number, item: 'View' | 'Compare' | 'Branch from it' | 'Restore' | 'Delete') {
  const row = versionRow(page, number)
  await row.hover()
  await row.getByTestId('version-menu').click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Name a branch in the branch dialog and submit it. */
export async function nameBranch(page: Page, name: string, action = 'Create') {
  const dialog = page.getByTestId('branch-dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: action }).click()
  await expect(dialog).toBeHidden()
}

export async function saveVersion(page: Page, name = '', note = '') {
  await page.getByTestId('save-version').click()
  const dialog = page.getByTestId('save-version-dialog')
  if (name) await dialog.getByLabel('Name').fill(name)
  if (note) await dialog.getByLabel('Note').fill(note)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

export async function confirmWith(page: Page, action: string) {
  await page.getByRole('alertdialog').getByRole('button', { name: action }).click()
}
