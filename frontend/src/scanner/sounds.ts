/** Scanner sounds made with Web Audio, no files (spec 003, AC-13). */
let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext()
    return context
  } catch {
    return null
  }
}

/** The context, running: a suspended (or iOS "interrupted") one resumes first (spec 017, AC-5). */
async function running(): Promise<AudioContext | null> {
  const ctx = audio()
  if (!ctx) return null
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx.state === 'running' ? ctx : null
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  // Scheduled from the clock now that it runs, so the whole tone is heard.
  const t = ctx.currentTime + 0.01 + start
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + duration)
}

export type ScanSound = 'click' | 'ding' | 'big_ding'

export async function playSound(sound: ScanSound) {
  const ctx = await running()
  if (!ctx) return
  if (sound === 'click') return tone(ctx, 1800, 0, 0.04, 0.15, 'square')
  if (sound === 'ding') return tone(ctx, 1320, 0, 0.35, 0.25)
  tone(ctx, 1320, 0, 0.3, 0.25)
  tone(ctx, 1760, 0.12, 0.5, 0.3)
}

/** Browsers only allow audio after a user gesture: call this on a tap. */
export function unlockAudio() {
  const ctx = audio()
  if (!ctx) return
  void ctx.resume().catch(() => {})
  // iOS unlocks Web Audio only once something plays during the gesture: one silent sample.
  try {
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, 1, 22050)
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    /* nothing to unlock */
  }
}

/**
 * The first tap or key anywhere in the app unlocks audio, so the tap that opens
 * the scanner already counts (spec 017, AC-4). Coming back to the tab resumes it.
 */
export function installAudioUnlock() {
  const events = ['pointerdown', 'touchend', 'keydown'] as const
  const unlock = () => {
    unlockAudio()
    if (context?.state === 'running') events.forEach((e) => document.removeEventListener(e, unlock, true))
  }
  events.forEach((e) => document.addEventListener(e, unlock, true))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context && context.state !== 'running') void context.resume().catch(() => {})
  })
}
