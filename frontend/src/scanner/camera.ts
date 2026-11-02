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
  return { video, status, error, start, stop, grabFrame }
}
