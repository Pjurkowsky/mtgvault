/**
 * The page makes room for a docked Unplaced sidebar with right padding on <html>
 * (spec 009, AC-7). Switching views swaps one sidebar for another, and the new
 * one mounts before the old one unmounts, so the sidebars share the padding:
 * it stays while any of them is docked.
 */
const PANEL = 288 // w-72
const docked = new Set<symbol>()
const mounted = new Set<symbol>()
let frame = 0

function apply() {
  const html = document.documentElement
  html.style.paddingRight = docked.size ? `${PANEL}px` : ''
  if (!mounted.size) {
    cancelAnimationFrame(frame)
    html.style.transition = ''
  }
}

export function useDock() {
  const me = Symbol('sidebar')
  mounted.add(me)
  // The page eases aside with the panel; not on first paint, and not with reduced motion.
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!still && mounted.size === 1) {
    frame = requestAnimationFrame(() => (document.documentElement.style.transition = 'padding-right 300ms cubic-bezier(0.32, 0.72, 0, 1)'))
  }
  return {
    dock(on: boolean) {
      if (on) docked.add(me)
      else docked.delete(me)
      apply()
    },
    release() {
      docked.delete(me)
      mounted.delete(me)
      apply()
    },
  }
}
