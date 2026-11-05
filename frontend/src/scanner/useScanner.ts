import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { api, type Schemas } from '@/api/client'
import type { ScanTarget } from '@/lib/scanTarget'
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
export type ScanDeckCard = Schemas['ScannedDeckCard']
export type Totals = Schemas['Totals']

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The scanner's frame loop (spec 003, AC-3 to AC-8): grab a frame, identify it
 * in the worker, decide (manavault's rules), and log accepted cards to the cart,
 * or where a deck's scans go (spec 005, AC-16, AC-17).
 */
/** Scan in order (spec 007): where a logged copy went, and the pocket Undo frees. */
export type ScannerHooks = {
  logged?: (result: Schemas['ScanResult']) => void
  undoSlot?: () => number | null
  undone?: () => void
}

export function useScanner(target: () => ScanTarget | null = () => null, hooks: ScannerHooks = {}) {
  const camera = useCamera()
  const status = ref<ScannerStatus>({ kind: 'loading', progress: null })
  const settings = ref<Schemas['ScannerSettings'] | null>(null)
  const lastScan = shallowRef<ScanItem | null>(null)
  const lastDeckCard = shallowRef<ScanDeckCard | null>(null)
  // Totals of where cards go: the cart, a location or a decklist.
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
    const [bundle, prefs] = await Promise.all([
      api.GET('/api/scanner/bundle/'),
      api.GET('/api/scanner/settings/'),
      refreshTotals(),
      loadLocked(),
    ])
    if (!bundle.data) {
      status.value = { kind: 'error', message: 'The card recognition model is not installed on the server yet.' }
      return
    }
    settings.value = prefs.data ?? null

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
    const to = target()
    const { data, error } = await api.POST('/api/scanner/scans/', {
      body: { gallery_id: candidate.id, illustration_id: candidate.illustration_id ?? null, ...(to ? { target: to } : {}) },
    })
    if (error || !data) {
      tracker = forgetLastLogged(tracker)
      status.value = { kind: 'steady', name: candidate.name }
      return
    }
    lastScan.value = data.item
    lastDeckCard.value = data.deck_card
    cart.value = data.totals
    hooks.logged?.(data)
    status.value = { kind: 'logged', name: (data.item ?? data.deck_card)?.printing.name ?? candidate.name }
    if (settings.value?.sounds) playSound(data.sound)
  }

  /** Result bar actions (AC-11). */
  async function plusOne() {
    if (lastDeckCard.value) return deckPlusOne()
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

  /** Decklist-only scans: +1 and Undo change the deck card (AC-17). */
  async function deckPlusOne() {
    const card = lastDeckCard.value
    if (!card) return
    const path = { params: { path: { id: card.deck, card_id: card.id } } }
    const { data } = await api.PATCH('/api/decks/{id}/cards/{card_id}/', { ...path, body: { quantity: card.quantity + 1 } })
    if (data) {
      lastDeckCard.value = { ...card, quantity: card.quantity + 1 }
      await refreshTotals()
    }
  }

  async function deckUndo() {
    const card = lastDeckCard.value
    if (!card) return
    const path = { params: { path: { id: card.deck, card_id: card.id } } }
    const { data } = card.quantity > 1
      ? await api.PATCH('/api/decks/{id}/cards/{card_id}/', { ...path, body: { quantity: card.quantity - 1 } })
      : await api.DELETE('/api/decks/{id}/cards/{card_id}/', path)
    if (!data) return
    tracker = forgetLastLogged(tracker)
    if (card.quantity > 1) lastDeckCard.value = { ...card, quantity: card.quantity - 1 }
    else {
      lastDeckCard.value = null
      status.value = { kind: 'looking' }
    }
    await refreshTotals()
  }

  async function undo() {
    if (lastDeckCard.value) return deckUndo()
    const row = lastScan.value
    if (!row) return
    const slot = hooks.undoSlot?.() ?? null
    const { data } = await api.POST('/api/scanner/scans/{id}/undo/', {
      params: { path: { id: row.id } }, ...(slot ? { body: { slot } } : {}),
    })
    if (!data) return
    hooks.undone?.()
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

  /** Totals of where cards go now. */
  async function refreshTotals() {
    const to = target()
    if (to?.kind === 'deck') {
      const { data } = await api.GET('/api/decks/{id}/', { params: { path: { id: to.deck } } })
      cart.value = data ? { card_count: data.counts.size, value: data.value, values: data.values } : null
      return
    }
    const { data } = await api.GET('/api/locations/')
    if (!data) return
    if (!to || to.kind === 'cart') cart.value = data.cart
    else if (to.location === null) cart.value = data.unfiled
    else cart.value = data.locations.find((l) => l.id === to.location) ?? null
  }
  const refreshCart = refreshTotals

  /** A new destination: the last card's bar no longer applies. */
  async function retarget() {
    lastScan.value = null
    lastDeckCard.value = null
    tracker = forgetLastLogged(tracker)
    await refreshTotals()
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
    camera, status, settings, lastScan, lastDeckCard, cart, ready,
    start, resume, plusOne, setFinish, undo, replaceLast, saveSettings, retarget,
  }
}
