import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { DATABASE_URL } from '../playwright.config'
import { choose, signUp, uniqueUser, type TestUser } from './helpers'

// Spec 020: staff choose where the scanner model comes from. The e2e server installs
// bundles into backend/var/scanner-e2e; these tests install copies of that bundle from a
// folder and put the original back afterwards.
const BACKEND = new URL('../../backend/', import.meta.url).pathname
const SCANNER_DIR = join(BACKEND, 'var/scanner-e2e')

function manage(code: string) {
  return execFileSync('uv', ['run', 'manage.py', 'shell', '-c', code], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL, SCANNER_DIR: 'var/scanner-e2e' },
  }).toString()
}

/** A copy of the installed bundle under a new version name and export date. */
function addBundle(folder: string, version: string, created: string) {
  const installed = readFileSync(join(SCANNER_DIR, 'current'), 'utf8').trim()
  cpSync(join(SCANNER_DIR, installed), join(folder, version), { recursive: true })
  const path = join(folder, version, 'manifest.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  writeFileSync(path, JSON.stringify({ ...manifest, version, created }))
}

/** Bearer headers for direct API calls as `user`. */
async function bearer(request: APIRequestContext, user: TestUser) {
  const login = await request.post('/api/auth/login/', { data: { login: user.username, password: user.password } })
  return { Authorization: `Bearer ${(await login.json()).access}` }
}

async function installedVersion(request: APIRequestContext, user: TestUser) {
  return (await (await request.get('/api/scanner/bundle/', { headers: await bearer(request, user) })).json()).version
}

async function makeStaff(page: Page, username: string) {
  manage(`from users.models import User; User.objects.filter(username='${username}').update(is_staff=True)`)
  await page.reload()
}

test.describe.configure({ mode: 'serial' })

let original = ''
let folder = ''
let backup = ''
test.beforeAll(() => {
  original = readFileSync(join(SCANNER_DIR, 'current'), 'utf8').trim()
  folder = mkdtempSync(join(tmpdir(), 'mtgvault-bundles-'))
  // Installs prune older bundles, so keep the original aside (outside the source folder).
  backup = mkdtempSync(join(tmpdir(), 'mtgvault-bundle-backup-'))
  cpSync(join(SCANNER_DIR, original), join(backup, original), { recursive: true })
})
test.afterAll(() => {
  // Back to the default source and the bundle the other tests expect.
  manage(
    "from scanner.models import ScannerSource as S; S.objects.filter(pk=1).update(kind='github', repo='cfbender/manavault', path='', syncing=False, last_error='')",
  )
  if (!existsSync(join(SCANNER_DIR, original))) cpSync(join(backup, original), join(SCANNER_DIR, original), { recursive: true })
  writeFileSync(join(SCANNER_DIR, 'current'), original)
  for (const name of readdirSync(SCANNER_DIR)) if (name.startsWith('e2e-')) rmSync(join(SCANNER_DIR, name), { recursive: true, force: true })
  rmSync(folder, { recursive: true, force: true })
  rmSync(backup, { recursive: true, force: true })
})

test('AC-1: only staff see the Scanner model section and may use its API', async ({ page }) => {
  const user = uniqueUser('model')
  await signUp(page, user)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByTestId('scanner-source')).toHaveCount(0)
  const headers = await bearer(page.request, user)
  expect((await page.request.get('/api/scanner/source/', { headers })).status()).toBe(403)
  expect((await page.request.post('/api/scanner/source/sync/', { headers })).status()).toBe(403)

  await makeStaff(page, user.username)
  await expect(page.getByTestId('scanner-source')).toBeVisible()
})

test('AC-2, AC-3, AC-5, AC-6: a folder source installs its newest bundle; a bad one keeps the model', async ({ page }) => {
  const user = uniqueUser('model')
  await signUp(page, user)
  await makeStaff(page, user.username)
  await page.goto('/settings')
  const section = page.getByTestId('scanner-source')

  // AC-2: installed model and the default GitHub source
  await expect(section.getByTestId('scanner-source-installed')).toContainText(original)
  await expect(section.getByRole('combobox', { name: 'Source' })).toHaveText('GitHub releases')
  await expect(section.getByLabel('Repository')).toHaveValue('cfbender/manavault')

  // AC-5: a path that is not a folder fails, and the installed model stays
  await choose(page, 'Source', 'Server folder')
  await section.getByLabel('Path').fill('relative/bundles')
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByText('Enter an absolute path on the server')).toBeVisible()
  await section.getByLabel('Path').fill(join(folder, 'missing'))
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByTestId('scanner-source-error')).toContainText('is not a folder on the server')
  await expect(section.getByTestId('scanner-source-installed')).toContainText(original)
  expect(await installedVersion(page.request, user)).toBe(original)

  // AC-3, AC-6: the newest bundle by its export date wins, not the newest name
  addBundle(folder, 'e2e-b-older', '2026-01-01T00:00:00+00:00')
  addBundle(folder, 'e2e-a-newer', '2026-06-01T00:00:00+00:00')
  await section.getByLabel('Path').fill(folder)
  await section.getByRole('button', { name: 'Save' }).click()
  await expect(section.getByTestId('scanner-source-installed')).toContainText('e2e-a-newer')
  await expect(section.getByTestId('scanner-source-error')).toHaveCount(0)
  await expect(section.getByTestId('scanner-source-synced')).toBeVisible()
  expect(await installedVersion(page.request, user)).toBe('e2e-a-newer')

  // the saved source is shown after a reload
  await page.reload()
  await expect(section.getByRole('combobox', { name: 'Source' })).toHaveText('Server folder')
  await expect(section.getByLabel('Path')).toHaveValue(folder)
})

test('AC-4, AC-8: Sync now and the sync command follow the saved folder', async ({ page }) => {
  const user = uniqueUser('model')
  await signUp(page, user)
  await makeStaff(page, user.username)
  await page.goto('/settings')
  const section = page.getByTestId('scanner-source')
  await expect(section.getByRole('combobox', { name: 'Source' })).toHaveText('Server folder')

  addBundle(folder, 'e2e-c', '2026-07-01T00:00:00+00:00')
  await section.getByRole('button', { name: 'Sync now' }).click()
  await expect(section.getByTestId('scanner-source-installed')).toContainText('e2e-c')

  // AC-8: the daily job's command installs from the same source
  addBundle(folder, 'e2e-d', '2026-08-01T00:00:00+00:00')
  execFileSync('uv', ['run', 'manage.py', 'sync_scanner_bundle'], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL, SCANNER_DIR: 'var/scanner-e2e' },
  })
  await page.reload()
  await expect(section.getByTestId('scanner-source-installed')).toContainText('e2e-d')
})
