import { expect, test, type Page } from '@playwright/test'
import { fakeCamera, GLARE_FEED } from '../playwright.config'
import { signUpAndLogIn } from './helpers'

// Spec 019 with the real recognition models and a fake camera showing Sol Ring with glare over its art.
test.use({ launchOptions: { args: fakeCamera(GLARE_FEED) } })
test.setTimeout(120_000)
const LOG_TIMEOUT = 60_000

const sheet = (page: Page) => page.getByTestId('scanner-settings')
const status = (page: Page) => page.getByTestId('scan-status')

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Scanner settings' }).click()
  await expect(sheet(page)).toBeVisible()
}

test('AC-1 to AC-4: Glare hint skips glare frames and says to tilt; sensitivity changes the limit', async ({ page, request }) => {
  const { api } = await signUpAndLogIn(page, request)
  await page.goto('/scan')
  await expect(status(page)).toHaveText(/Hold steady|Added/, { timeout: LOG_TIMEOUT }) // AC-2: no glare hint while off
  await openSettings(page)
  for (const name of ['Glare hint', 'Combine frames', 'Suggest guesses']) {
    await expect(sheet(page).getByRole('switch', { name })).not.toBeChecked()
  }
  await expect(sheet(page).getByTestId('glare-sensitivity')).toHaveCount(0)
  await expect(sheet(page).getByTestId('camera-controls')).toHaveCount(0) // this camera changes nothing (AC-9)

  await sheet(page).getByRole('switch', { name: 'Glare hint' }).click()
  await expect(sheet(page).getByTestId('glare-sensitivity')).toBeVisible()
  await expect.poll(async () => api.get('/api/scanner/settings/')).toMatchObject({ glare_hint: true, glare_sensitivity: 50 })
  await page.keyboard.press('Escape')
  await expect(status(page)).toHaveText('Glare: tilt the phone', { timeout: LOG_TIMEOUT })
  await page.waitForTimeout(3000)
  await expect(status(page)).toHaveText('Glare: tilt the phone')
  await expect(page.getByTestId('result-bar')).toHaveCount(0)

  // Low: a third of the art washed out is under the limit, so the card is identified again.
  await openSettings(page)
  await sheet(page).getByRole('slider', { name: 'Glare sensitivity' }).focus()
  await page.keyboard.press('Home')
  await expect.poll(async () => (await api.get('/api/scanner/settings/')).glare_sensitivity).toBe(0)
  await page.keyboard.press('Escape')
  await expect(status(page)).not.toHaveText('Glare: tilt the phone', { timeout: LOG_TIMEOUT })
})

test('AC-3, AC-5, AC-8: glare frames keep the run; still frames are averaged; the strip closes when the card moves', async ({ page, request }) => {
  await signUpAndLogIn(page, request)
  await page.goto('/settings')
  const out = await page.evaluate(async () => {
    const { RecognizerClient } = await import('/src/scanner/recognition/client.ts' as string)
    const { api } = await import('/src/api/client.ts' as string)
    const decision = await import('/src/scanner/decision.ts' as string)
    const client = new RecognizerClient()
    await client.load((await api.GET('/api/scanner/bundle/')).data, 1)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = 'https://cards.scryfall.io/large/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg'
    await image.decode()
    const frame = (dx: number, glare: boolean) => {
      const c = document.createElement('canvas')
      c.width = c.height = 640
      const ctx = c.getContext('2d')!
      ctx.fillStyle = 'rgb(118, 112, 104)'
      ctx.fillRect(0, 0, 640, 640)
      const h = 300, w = (h * image.width) / image.height, x = 320 - w / 2 + dx, y = 170
      ctx.drawImage(image, x, y, w, h)
      if (glare) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(x + 0.1 * w, y + 0.12 * h, 0.8 * w, 0.3 * h)
      }
      const d = ctx.getImageData(0, 0, 640, 640)
      return { data: d.data, width: 640, height: 640 }
    }
    const combined: number[] = []
    for (let i = 0; i < 6; i++) combined.push((await client.identify(frame(0, false), { glareLimit: null, combine: true })).combined)
    combined.push((await client.identify(frame(150, false), { glareLimit: null, combine: true })).combined)
    const glared = await client.identify(frame(0, true), { glareLimit: 0.225, combine: false })

    // A glare frame between two agreeing frames keeps the run (AC-3).
    const clean = await client.identify(frame(0, false), { glareLimit: 0.225, combine: false })
    let t = decision.evaluateFrame(decision.INITIAL_TRACKER, clean).tracker
    t = decision.evaluateFrame(t, { ...glared, quad: clean.quad }).tracker
    const streak = t.streak

    // An open strip closes once the card moves (AC-8).
    const shown = { since: 0, quad: clean.quad, shown: clean.candidates.slice(0, 3), dismissed: false }
    const moved = await client.identify(frame(150, false), { glareLimit: null, combine: false })
    const after = decision.trackGuesses(shown, moved, { type: 'tracking', candidate: moved.candidates[0] }, 100)
    client.terminate()
    return { combined, glared: [glared.glared, glared.candidates.length], streak, closed: after.shown }
  })
  expect(out.combined).toEqual([1, 2, 3, 4, 5, 5, 1]) // up to 5 still frames; a moved card starts over
  expect(out.glared).toEqual([true, 0])
  expect(out.streak).toBe(1)
  expect(out.closed).toBeNull()
})

test('AC-9, AC-10: camera exposure, zoom and focus apply at once, are kept on this device, and reset', async ({ page, request }) => {
  // An Android-like camera that reports what it can change, and records what the scanner sets.
  await page.addInitScript(() => {
    const w = window as unknown as { __applied: Record<string, unknown>[] }
    w.__applied = []
    const caps = MediaStreamTrack.prototype.getCapabilities
    MediaStreamTrack.prototype.getCapabilities = function () {
      return {
        ...caps.call(this),
        exposureMode: ['continuous', 'manual'], exposureCompensation: { min: -2, max: 2, step: 0.5 },
        zoom: { min: 1, max: 4, step: 0.5 }, focusMode: ['continuous', 'manual'], focusDistance: { min: 0, max: 1, step: 0.1 },
      } as MediaTrackCapabilities
    }
    const settings = MediaStreamTrack.prototype.getSettings
    MediaStreamTrack.prototype.getSettings = function () {
      return { ...settings.call(this), exposureCompensation: 0, zoom: 1 } as MediaTrackSettings
    }
    MediaStreamTrack.prototype.applyConstraints = async function (c?: MediaTrackConstraints) {
      w.__applied.push((c?.advanced?.[0] ?? {}) as Record<string, unknown>)
    }
  })
  const last = () => page.evaluate(() => (window as unknown as { __applied: Record<string, unknown>[] }).__applied.at(-1))
  await signUpAndLogIn(page, request)
  await page.goto('/scan')
  await expect(status(page)).toBeVisible({ timeout: LOG_TIMEOUT })
  await openSettings(page)
  const camera = sheet(page).getByTestId('camera-controls')
  await expect(camera).toBeVisible()

  await camera.getByRole('slider', { name: 'Exposure' }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(last).toMatchObject({ exposureMode: 'continuous', exposureCompensation: -0.5, zoom: 1, focusMode: 'continuous' })
  await camera.getByRole('slider', { name: 'Zoom' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(last).toMatchObject({ exposureCompensation: -0.5, zoom: 1.5 })
  await camera.getByRole('switch', { name: 'Auto focus' }).click()
  await expect(camera.getByRole('slider', { name: 'Focus distance' })).toBeVisible()
  await expect.poll(last).toMatchObject({ focusMode: 'manual', focusDistance: 0.5 })

  // Kept on this device: applied when the scanner opens again.
  await page.reload()
  await expect(status(page)).toBeVisible({ timeout: LOG_TIMEOUT })
  await expect.poll(last).toMatchObject({ exposureCompensation: -0.5, zoom: 1.5, focusMode: 'manual', focusDistance: 0.5 })
  await openSettings(page)
  await camera.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(last).toEqual({ exposureMode: 'continuous', exposureCompensation: 0, zoom: 1, focusMode: 'continuous' })
  await expect(camera.getByRole('switch', { name: 'Auto focus' })).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('mtgvault.scanner-camera'))).toBeNull()
})
