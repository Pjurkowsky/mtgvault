import { expect, test } from '@playwright/test'
import { binderSlot as slot, signUpAndLogIn } from './helpers'

// Spec 021: bigger pockets (AC-3).
const width = async (l: ReturnType<typeof slot>) => (await l.boundingBox())!.width

test.describe('Binder sizes', () => {
  test('AC-3: S, M and L pockets are 5, 7 and 9.5 rem', async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1400 }) // tall enough that L isn't capped (spec 023, AC-8)
    const { api } = await signUpAndLogIn(page, request)
    const binder = await api.location('Sizes')
    await page.goto(`/locations/${binder}`)
    for (const [name, px] of [['Small cards', 80], ['Medium cards', 112], ['Large cards', 152]] as const) {
      await page.getByRole('button', { name }).click()
      await expect.poll(() => width(slot(page, 1, 1))).toBe(px)
    }
  })
  // AC-4 (Fit) was replaced by spec 023, AC-7 and AC-8: see ui-polish.spec.ts.
})
