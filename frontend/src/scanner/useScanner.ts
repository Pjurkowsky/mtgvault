import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { api, type Schemas } from '@/api/client'
import { useCamera } from './camera'
import { evaluateFrame, FRAME_PACING, forgetLastLogged, frameInterval, INITIAL_TRACKER, type FrameOutcome, type ScanTracker } from './decision'
import { RecognizerClient, type LoadProgress } from './recognition/client'
import type { BundleInfo } from './recognition/messages'
import type { Candidate } from './recognition/pipeline'
import { playSound } from './sounds'

export type ScannerStatus =
  | { kind: 'loading'; progress: LoadProgress | null }
  | { kind: 'looking' }
  | { kind: 'steady'; name: string | null }
  | { kind: 'logged'; name: string }
  | { kind: 'outside'; name: string }
  | { kind: 'paused' }
  | { kind: 'error'; message: string }

export type ScanItem = Schemas['Item']
export type Totals = Schemas['Totals']

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The scanner's frame loop (spec 003, AC-3 to AC-8): grab a frame, identify it
 * in the worker, decide (manavault's rules), and log accepted cards to the cart.
 */
export function useScanner() {
  const camera = useCamera()
  const status = ref<ScannerStatus>({ kind: 'loading', progress: null })
  const settings = ref<Schemas['ScannerSettings'] | null>(null)
  const lastScan = shallowRef<ScanItem | null>(null)
  const cart = ref<Totals | null>(null)
  const ready = ref<{ version: string; threads: number } | null>(null)

  let client: RecognizerClient | null = null
  let tracker: ScanTracker = INITIAL_TRACKER
  let locked = new Set<string>()
  let running = false
  let lastCardAt = performance.now()

  const allowed = (candidate: Candidate) =>
    locked.size === 0 || (!!candidate.illustration_id && locked.has(candidate.illustration_id))

  async function loadLocked() {
    const { data } = await api.GET('/api/scanner/locked-illustrations/')
    locked = new Set((data?.illustration_ids ?? []).map(String))
  }

  async function start() {
    const [bundle, prefs, locations] = await Promise.all([
      api.GET('/api/scanner/bundle/'),
      api.GET('/api/scanner/settings/'),
      api.GET('/api/locations/'),
      loadLocked(),
    ])
    if (!bundle.data) {
      status.value = { kind: 'error', message: 'The card recognition model is not installed on the server yet.' }
      return
    }
    settings.value = prefs.data ?? null
    cart.value = locations.data?.cart ?? null

    client = new RecognizerClient()
    // Several threads only help on the cross-origin isolated /scan/fast page (AC-16).
    const threads = settings.value?.fast && crossOriginIsolated ? 0 : 1
    try {
      const info = await client.load(bundle.data as unknown as BundleInfo, threads, (progress) => {
        status.value = { kind: 'loading', progress }
      })
      ready.value = { version: info.version, threads: info.threads }
    } catch (error) {
      status.value = { kind: 'error', message: `Could not load the recognition model: ${(error as Error).message}` }
      return
    }
    await resume()
  }

  async function resume() {
    // Leave the loading screen first, so a camera problem can show (AC-2).
    status.value = { kind: 'looking' }
    await camera.start()
    if (camera.status.value !== 'live') return
    lastCardAt = performance.now()
    status.value = { kind: 'looking' }
    if (!running) void loop()
  }

  function pause() {
    running = false
    camera.stop()
    status.value = { kind: 'paused' }
  }

  async function loop() {
    running = true
    while (running && client) {
      const started = performance.now()
      let outcome: FrameOutcome['type'] = 'empty'
      const frame = camera.grabFrame()
      if (frame) {
        try {
          const result = await client.identify(frame)
          if (!running) break
          const decision = evaluateFrame(tracker, result, allowed)
          tracker = decision.tracker
          outcome = decision.outcome.type
          await react(decision.outcome)
        } catch {
          // One failed frame is not fatal; the next one usually works.
        }
      }
      if (outcome !== 'empty') lastCardAt = performance.now()
      const sinceCard = performance.now() - lastCardAt
      if (sinceCard >= FRAME_PACING.sleepMs) {
        pause() // AC-4: save battery after a minute without a card
        break
      }
      const wait = frameInterval(outcome, sinceCard) - (performance.now() - started)
      await sleep(Math.max(FRAME_PACING.minGapMs, wait))
    }
  }

  async function react(outcome: FrameOutcome) {
    if (outcome.type === 'empty') {
      if (status.value.kind !== 'logged') status.value = { kind: 'looking' }
    } else if (outcome.type === 'tracking') {
      status.value = { kind: 'steady', name: outcome.candidate?.name ?? null }
    } else if (outcome.type === 'outside-lock') {
      status.value = { kind: 'outside', name: outcome.candidate.name }
    } else if (outcome.type === 'accept') {
      await log(outcome.candidate)
    }
  }

  async function log(candidate: Candidate) {
    const { data, error } = await api.POST('/api/scanner/scans/', {
      body: { gallery_id: candidate.id, illustration_id: candidate.illustration_id ?? null },
    })
    if (error || !data) {
      tracker = forgetLastLogged(tracker)
      status.value = { kind: 'steady', name: candidate.name }
      return
    }
    if (!data.item) return
    lastScan.value = data.item
    cart.value = data.totals
    status.value = { kind: 'logged', name: data.item.printing.name }
    if (settings.value?.sounds) playSound(data.sound)
  }

  /** Result bar actions (AC-11). */
  async function plusOne() {
    const row = lastScan.value
    if (!row) return
    const { data } = await api.PATCH('/api/items/{id}/', { params: { path: { id: row.id } }, body: { quantity: row.quantity + 1 } })
    if (data) {
      lastScan.value = data.item
      await refreshCart()
    }
  }

  async function setFinish(finish: Schemas['FinishEnum']) {
    const row = lastScan.value
    if (!row || row.finish === finish) return
    const { data } = await api.PATCH('/api/items/{id}/', { params: { path: { id: row.id } }, body: { finish } })
    if (data) {
      lastScan.value = data.item
      await refreshCart()
    }
  }

  async function undo() {
    const row = lastScan.value
    if (!row) return
    const { data } = await api.POST('/api/scanner/scans/{id}/undo/', { params: { path: { id: row.id } } })
    if (!data) return
    cart.value = data.totals
    tracker = forgetLastLogged(tracker) // the same card may be scanned again
    if (data.remaining === 0) {
      lastScan.value = null
      status.value = { kind: 'looking' }
    } else {
      lastScan.value = { ...row, quantity: data.remaining }
    }
  }

  function replaceLast(item: ScanItem) {
    lastScan.value = item
    void refreshCart()
  }

  async function refreshCart() {
    const { data } = await api.GET('/api/locations/')
    if (data) cart.value = data.cart
  }

  async function saveSettings(patch: Partial<Schemas['ScannerSettings']>) {
    const { data } = await api.PATCH('/api/scanner/settings/', { body: patch })
    if (!data) return false
    settings.value = data
    if ('locked_sets' in patch) await loadLocked()
    return true
  }

  // AC-4: no camera while the tab is hidden.
  function onVisibility() {
    if (document.hidden) {
      if (running) {
        running = false
        camera.stop()
      }
    } else if (status.value.kind !== 'paused' && client && camera.status.value !== 'live') {
      void resume()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  onBeforeUnmount(() => {
    running = false
    document.removeEventListener('visibilitychange', onVisibility)
    client?.terminate()
  })

  return {
    camera, status, settings, lastScan, cart, ready,
    start, resume, plusOne, setFinish, undo, replaceLast, saveSettings,
  }
}
