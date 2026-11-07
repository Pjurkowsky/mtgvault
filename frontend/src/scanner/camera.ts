import { onBeforeUnmount, ref, shallowRef } from 'vue'
import type { RgbaImage } from './recognition/pipeline'

/** Frames sent to the recognizer are this many pixels square (the bundle's `scene`). */
export const FRAME_SIZE = 640

export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'missing' | 'failed'

export const CAMERA_HELP: Record<CameraError, string> = {
  insecure: 'The camera only works over HTTPS (or on localhost).',
  unsupported: 'This browser cannot use a camera.',
  denied: 'Camera access is blocked. Allow it in the browser’s site settings, then reload.',
  missing: 'No camera found.',
  failed: 'The camera could not start. Close other apps using it and try again.',
}

/** A camera setting's range, as the camera reports it. */
export type Range = { min: number; max: number; step: number }

/** What this camera lets the scanner change (spec 019, AC-9); missing = not supported. */
export type CameraControls = {
  exposure?: Range
  zoom?: Range
  /** Manual focus distance; `autoFocus` says whether it can go back to continuous focus. */
  focus?: Range
  autoFocus: boolean
}

/** Values the user set; missing = the camera's own. `focus: 'auto'` is continuous focus. */
export type CameraValues = { exposure?: number; zoom?: number; focus?: 'auto' | number }

/** Saved on this device, not the account: each phone's camera has its own ranges (AC-10). */
const CAMERA_STORAGE = 'mtgvault.scanner-camera'

function loadValues(): CameraValues {
  try {
    const parsed = JSON.parse(localStorage.getItem(CAMERA_STORAGE) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

type Capabilities = MediaTrackCapabilities & {
  exposureCompensation?: Range; exposureMode?: string[]; zoom?: Range; focusDistance?: Range; focusMode?: string[]
}

function controlsOf(caps: Capabilities): CameraControls {
  const range = (r?: Range) => (r && r.max > r.min ? { min: r.min, max: r.max, step: r.step || (r.max - r.min) / 100 } : undefined)
  const manualFocus = caps.focusMode?.includes('manual') ? range(caps.focusDistance) : undefined
  return {
    exposure: range(caps.exposureCompensation),
    zoom: range(caps.zoom),
    focus: manualFocus,
    autoFocus: !!caps.focusMode?.includes('continuous'),
  }
}

/** The constraints that set `values`, falling back to `defaults` (the camera's own at start). */
function constraintsFor(values: CameraValues, defaults: CameraValues, controls: CameraControls) {
  const c: Record<string, unknown> = {}
  if (controls.exposure) {
    c.exposureMode = 'continuous'
    c.exposureCompensation = values.exposure ?? defaults.exposure ?? 0
  }
  if (controls.zoom) c.zoom = values.zoom ?? defaults.zoom ?? controls.zoom.min
  const focus = values.focus ?? 'auto'
  if (typeof focus === 'number' && controls.focus) {
    c.focusMode = 'manual'
    c.focusDistance = focus
  } else if (controls.autoFocus) {
    c.focusMode = 'continuous'
  }
  return c
}

/**
 * The rear camera (spec 003, AC-2). `grabFrame` fits the whole video into a
 * 640 px square, so a card anywhere in view is found (as in manavault).
 */
export function useCamera() {
  const video = shallowRef<HTMLVideoElement | null>(null)
  const status = ref<'idle' | 'starting' | 'live' | 'error'>('idle')
  const error = ref<CameraError | null>(null)
  let stream: MediaStream | null = null
  let canvas: HTMLCanvasElement | null = null
  let generation = 0
  // Spec 019, AC-9, AC-10: what the camera can change, and what the user set.
  const controls = ref<CameraControls>({ autoFocus: false })
  const values = ref<CameraValues>(loadValues())
  let defaults: CameraValues = {}

  function track() {
    return stream?.getVideoTracks()[0] ?? null
  }

  async function apply() {
    const t = track()
    if (!t) return
    const constraints = constraintsFor(values.value, defaults, controls.value)
    if (Object.keys(constraints).length) await t.applyConstraints({ advanced: [constraints] }).catch(() => {})
  }

  /** Change one camera value at once and remember it on this device. */
  async function setControl(next: CameraValues) {
    values.value = { ...values.value, ...next }
    try {
      localStorage.setItem(CAMERA_STORAGE, JSON.stringify(values.value))
    } catch {
      // Private mode: the value still applies until the scanner closes.
    }
    await apply()
  }

  /** Back to the camera's own settings. */
  async function resetControls() {
    values.value = {}
    try {
      localStorage.removeItem(CAMERA_STORAGE)
    } catch {
      // Nothing saved.
    }
    await apply()
  }

  function readControls() {
    const t = track()
    if (!t?.getCapabilities) return
    controls.value = controlsOf(t.getCapabilities() as Capabilities)
    const now = t.getSettings() as MediaTrackSettings & { exposureCompensation?: number; zoom?: number }
    defaults = { exposure: now.exposureCompensation, zoom: now.zoom }
  }

  async function start() {
    const mine = ++generation
    error.value = null
    if (!window.isSecureContext) return fail('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported')
    status.value = 'starting'
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { max: 30 } },
      })
      if (mine !== generation) return next.getTracks().forEach((t) => t.stop())
      stream = next
      readControls()
      await apply()
      if (video.value) {
        video.value.srcObject = stream
        await video.value.play().catch(() => {})
      }
      status.value = 'live'
    } catch (err) {
      const name = (err as DOMException)?.name
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing' : 'failed')
    }
  }

  function fail(reason: CameraError) {
    status.value = 'error'
    error.value = reason
  }

  function stop() {
    generation++
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (video.value) video.value.srcObject = null
    if (status.value !== 'error') status.value = 'idle'
  }

  function grabFrame(): RgbaImage | null {
    const v = video.value
    if (!v || v.readyState < 2 || !v.videoWidth) return null
    canvas ??= document.createElement('canvas')
    canvas.width = FRAME_SIZE
    canvas.height = FRAME_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    const scale = FRAME_SIZE / Math.max(v.videoWidth, v.videoHeight)
    const w = v.videoWidth * scale
    const h = v.videoHeight * scale
    context.fillStyle = 'rgb(18, 18, 18)'
    context.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE)
    context.drawImage(v, (FRAME_SIZE - w) / 2, (FRAME_SIZE - h) / 2, w, h)
    const pixels = context.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE)
    return { data: pixels.data, width: FRAME_SIZE, height: FRAME_SIZE }
  }

  onBeforeUnmount(stop)
  return { video, status, error, start, stop, grabFrame, controls, values, setControl, resetControls }
}
