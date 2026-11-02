import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import { CAMERA_FEED } from '../playwright.config'

/**
 * Builds the fake camera feed for the scanner tests (spec 003): Sol Ring (C21)
 * lying on a grey table, as an MJPEG file Chromium plays as its camera.
 * Downloaded from Scryfall once and cached (gitignored).
 */
setup('camera feed', async ({ page }) => {
  if (existsSync(CAMERA_FEED)) return
  const jpeg = await page.evaluate(async () => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = 'https://cards.scryfall.io/large/front/4/c/4cbc6901-6a4a-4d0a-83ea-7eefa3b35021.jpg'
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgb(118, 112, 104)'
    ctx.fillRect(0, 0, 1280, 720)
    const h = 520
    const w = (h * image.width) / image.height
    ctx.drawImage(image, 640 - w / 2 + 40, 360 - h / 2 - 10, w, h)
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!
  })
  const frame = Buffer.from(jpeg, 'base64')
  mkdirSync(CAMERA_FEED.replace(/\/[^/]+$/, ''), { recursive: true })
  writeFileSync(CAMERA_FEED, Buffer.concat(Array.from({ length: 10 }, () => frame)))
})
