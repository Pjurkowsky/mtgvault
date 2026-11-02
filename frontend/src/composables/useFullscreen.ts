import { reactive } from 'vue'

/** One full-screen card preview for the whole app (spec 002, AC-18b). */
export const fullscreen = reactive({ image: '', name: '' })

export function showFullscreen(image: string | null | undefined, name: string) {
  if (!image) return
  fullscreen.image = image
  fullscreen.name = name
}

export function hideFullscreen() {
  fullscreen.image = ''
}
