import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Schemas } from '@/api/client'
import { usePreference } from '@/composables/usePreference'

type Board = Schemas['BoardSeat'][]
/** Where the replay is: a turn, and one of its events or none (the board at the turn's end). */
export type Cursor = { turn: number; event: number | null }

export const SPEEDS = [
  { value: 'slow', label: 'Slow', ms: 2000 },
  { value: 'normal', label: 'Normal', ms: 1000 },
  { value: 'fast', label: 'Fast', ms: 400 },
  { value: 'veryfast', label: 'Very fast', ms: 100 },
] as const
export type Speed = (typeof SPEEDS)[number]['value']

const attacks = (board: Board | undefined) => !!board?.some((s) => s.battlefield.some((c) => c.attacking))

/**
 * Stepping through a replay by event or turn, and autoplay (spec 026, AC-10 to AC-13).
 * Its settings are remembered in the browser.
 */
export function useReplayPlayer(game: Ref<Schemas['Replay'] | null>) {
  const cursor = ref<Cursor>({ turn: 0, event: null })
  const turns = computed(() => game.value?.turns ?? [])

  const settings = {
    speed: usePreference<Speed>('replay.speed', 'normal', SPEEDS.map((s) => s.value)),
    unit: usePreference('replay.unit', 'event', ['event', 'turn'] as const),
    combatPause: usePreference('replay.combat-pause', 'off', ['on', 'off'] as const),
    follow: usePreference('replay.follow', 'all'),
    deaths: usePreference('replay.deaths', 'on', ['on', 'off'] as const),
    graveyard: usePreference('replay.graveyard', 'on', ['on', 'off'] as const),
  }
  /** The followed seat, if it sits in this game. */
  const followed = computed(() => {
    const seat = Number(settings.follow.value)
    return settings.follow.value !== 'all' && game.value?.players.some((p) => p.seat === seat) ? seat : null
  })

  const boardIndex = (c: Cursor) => {
    const t = turns.value[c.turn]
    if (!t) return 0
    return c.event === null ? t.board : t.events[c.event]?.board ?? t.board
  }
  const firstOf = (t: number): Cursor | null => (t >= turns.value.length ? null : { turn: t, event: turns.value[t]!.events.length ? 0 : null })
  const lastOf = (t: number): Cursor | null => {
    if (t < 0) return null
    const n = turns.value[t]!.events.length
    return { turn: t, event: n ? n - 1 : null }
  }
  /** The next event, into the next turn after the last one (AC-10). From a turn's end, its first event. */
  function nextEvent(c: Cursor): Cursor | null {
    const n = turns.value[c.turn]?.events.length ?? 0
    if (c.event === null) return n ? { turn: c.turn, event: 0 } : firstOf(c.turn + 1)
    return c.event + 1 < n ? { turn: c.turn, event: c.event + 1 } : firstOf(c.turn + 1)
  }
  function prevEvent(c: Cursor): Cursor | null {
    if (c.event === null || c.event === 0) return lastOf(c.turn - 1)
    return { turn: c.turn, event: c.event - 1 }
  }
  /** The step before this one, as a turn's end is its last event: what deaths are compared with (AC-7, AC-8). */
  const previousBoard = computed<Board | null>(() => {
    const c = cursor.value
    const n = turns.value[c.turn]?.events.length ?? 0
    const here = c.event === null && n ? { turn: c.turn, event: n - 1 } : c
    const before = prevEvent(here)
    if (!before || !game.value) return null
    const a = boardIndex(before)
    const b = boardIndex(here)
    return a === b ? null : game.value.boards[a] ?? null
  })
  const board = computed<Board | null>(() => game.value?.boards[boardIndex(cursor.value)] ?? null)
  /** Attackers were just declared at this step. */
  const declares = (c: Cursor) => {
    if (c.event === null || !game.value) return false
    const before = prevEvent(c)
    return attacks(game.value.boards[boardIndex(c)]) && !(before && attacks(game.value.boards[boardIndex(before)]))
  }

  // Autoplay (AC-11, AC-12)
  const playing = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  const ms = computed(() => SPEEDS.find((s) => s.value === settings.speed.value)?.ms ?? 1000)
  const mine = (t: number) => followed.value === null || turns.value[t]?.active === followed.value
  /** The next of the followed player's turns from t on. */
  function ownTurn(t: number): number | null {
    for (let i = t; i < turns.value.length; i++) if (mine(i) && (followed.value === null || turns.value[i]!.number > 0)) return i
    return null
  }
  function autoNext(c: Cursor): { to: Cursor; pause: boolean } | null {
    if (settings.unit.value === 'turn') {
      const t = ownTurn(c.turn + 1)
      if (t === null) return null
      // Pause at combat in turn steps: stop on the turn's attack.
      if (settings.combatPause.value === 'on') {
        const at = turns.value[t]!.events.findIndex((_, e) => declares({ turn: t, event: e }))
        if (at >= 0) return { to: { turn: t, event: at }, pause: true }
      }
      return { to: { turn: t, event: null }, pause: false }
    }
    let next = nextEvent(c)
    if (next && !mine(next.turn)) {
      const t = ownTurn(next.turn)
      next = t === null ? null : firstOf(t)
    }
    if (!next) return null
    return { to: next, pause: settings.combatPause.value === 'on' && declares(next) }
  }
  function tick() {
    const step = autoNext(cursor.value)
    if (!step) return pause()
    cursor.value = step.to
    if (step.pause || !autoNext(step.to)) return pause()
    timer = setTimeout(tick, ms.value)
  }
  function play() {
    if (!turns.value.length) return
    // At the end, from the start again (Assumptions, AC-11).
    if (!autoNext(cursor.value)) {
      const t = ownTurn(0) ?? 0
      cursor.value = settings.unit.value === 'turn' ? { turn: t, event: null } : firstOf(t) ?? { turn: 0, event: null }
    }
    playing.value = true
    clearTimeout(timer)
    timer = setTimeout(tick, ms.value)
  }
  function pause() {
    playing.value = false
    clearTimeout(timer)
  }
  const toggle = () => (playing.value ? pause() : play())
  watch(ms, () => {
    if (!playing.value) return
    clearTimeout(timer)
    timer = setTimeout(tick, ms.value)
  })
  onBeforeUnmount(() => clearTimeout(timer))

  // Manual steps pause autoplay and go everywhere, followed or not.
  function move(to: Cursor | null) {
    pause()
    if (to) cursor.value = to
  }
  const goTurn = (t: number) => move({ turn: Math.max(0, Math.min(turns.value.length - 1, t)), event: null })
  const reset = () => {
    pause()
    cursor.value = { turn: 0, event: null }
  }

  return {
    cursor, board, previousBoard, settings, playing,
    hasNextEvent: computed(() => !!nextEvent(cursor.value)),
    hasPrevEvent: computed(() => !!prevEvent(cursor.value)),
    next: () => move(nextEvent(cursor.value)),
    prev: () => move(prevEvent(cursor.value)),
    nextTurn: () => goTurn(cursor.value.turn + 1),
    prevTurn: () => goTurn(cursor.value.turn - 1),
    goTurn,
    select: (event: number) => move({ turn: cursor.value.turn, event }),
    toggle, pause, reset,
  }
}
