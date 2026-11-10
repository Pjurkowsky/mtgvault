import { reactive } from 'vue'

/** One full-screen card preview for the whole app (spec 002, AC-18b); `back` turns over (spec 023, AC-16). */
export const fullscreen = reactive({ image: '', name: '', back: '', flipped: false })

export function showFullscreen(image: string | null | undefined, name: string, back?: string | null) {
  if (!image) return
  fullscreen.image = image
  fullscreen.name = name
  fullscreen.back = back ?? ''
  fullscreen.flipped = false
}

export function hideFullscreen() {
  fullscreen.image = ''
}
