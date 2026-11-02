/** Scanner sounds made with Web Audio, no files (spec 003, AC-13). */
let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

function tone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const ctx = audio()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  const t = ctx.currentTime + start
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + duration)
}

export type ScanSound = 'click' | 'ding' | 'big_ding'

export function playSound(sound: ScanSound) {
  if (sound === 'click') return tone(1800, 0, 0.04, 0.15, 'square')
  if (sound === 'ding') return tone(1320, 0, 0.35, 0.25)
  tone(1320, 0, 0.3, 0.25)
  tone(1760, 0.12, 0.5, 0.3)
}

/** Browsers only allow audio after a user gesture: call this on the first tap. */
export function unlockAudio() {
  audio()
}
