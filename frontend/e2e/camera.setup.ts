import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import { CAMERA_FEED, GLARE_FEED, UNSURE_FEED } from '../playwright.config'

/**
 * Builds the fake camera feeds for the scanner tests: Sol Ring (C21) lying on a
 * grey table (spec 003), and for spec 019 the same with glare over its art or
 * out of focus. MJPEG files Chromium plays as its camera. Downloaded from
 * Scryfall once and cached (gitignored).
 */
const FEEDS = { plain: CAMERA_FEED, glare: GLARE_FEED, unsure: UNSURE_FEED }

setup('camera feeds', async ({ page }) => {
  const missing = Object.entries(FEEDS).filter(([, path]) => !existsSync(path))
  if (!missing.length) return
  const jpegs = await page.evaluate(async (kinds) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = 'https://cards.scryfall.io/large/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg'
    await image.decode()
    const draw = (kind: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'rgb(118, 112, 104)'
      ctx.fillRect(0, 0, 1280, 720)
      const h = 520
      const w = (h * image.width) / image.height
      const x = 640 - w / 2 + 40
      const y = 360 - h / 2 - 10
      if (kind === 'unsure') {
        // Out of focus and faded: best match 0.56-0.58 wherever the card sits, so it never logs.
        ctx.filter = 'blur(15px)'
        ctx.drawImage(image, x, y, w, h)
        ctx.filter = 'none'
        ctx.fillStyle = 'rgba(118, 112, 104, 0.4)'
        ctx.fillRect(x, y, w, h)
      } else ctx.drawImage(image, x, y, w, h)
      if (kind === 'glare') {
        // A pocket reflection: about a third of the art washed out (measured share 0.33).
        const g = ctx.createRadialGradient(x + 0.5 * w, y + 0.3 * h, 0, x + 0.5 * w, y + 0.3 * h, 0.3 * w)
        g.addColorStop(0, '#fff')
        g.addColorStop(0.7, '#fff')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 1280, 720)
      }
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!
    }
    return Object.fromEntries(kinds.map((k) => [k, draw(k)]))
  }, missing.map(([kind]) => kind))
  for (const [kind, path] of missing) {
    const frame = Buffer.from(jpegs[kind]!, 'base64')
    mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true })
    writeFileSync(path, Buffer.concat(Array.from({ length: 10 }, () => frame)))
  }
})
