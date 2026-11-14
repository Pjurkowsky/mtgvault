import { ref } from 'vue'
import { api, type Schemas } from '@/api/client'

/** Pod simulation with Forge (specs 024, 025). */
export type Run = Schemas['Run']
export type Opponent = Schemas['Opponent']
export type QueueEntry = Schemas['QueueEntry']
export type RunRow = Schemas['RunRow']
export type Profile = 'Default' | 'Cautious' | 'Reckless' | 'Experimental' | 'Hard' | 'Hardest'
export type Lookahead = Run['lookahead']
export type SeatMode = 'rotate' | 'random' | 'fixed'

export const PROFILES: Profile[] = ['Default', 'Cautious', 'Reckless', 'Experimental', 'Hard', 'Hardest']
/** Forge's look-ahead AI (spec 029, AC-3). */
export const LOOKAHEAD: { value: Lookahead; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'light', label: 'Light' },
  { value: 'normal', label: 'Normal' },
  { value: 'max', label: 'Maximum' },
]
export const lookaheadLabel = (value: Lookahead) => LOOKAHEAD.find((l) => l.value === value)?.label ?? value
export const SEAT_MODES: { value: SeatMode; label: string; hint: string }[] = [
  { value: 'rotate', label: 'Rotate', hint: 'Each deck goes first about equally often' },
  { value: 'random', label: 'Random', hint: 'Seats are shuffled every game' },
  { value: 'fixed', label: 'Fixed', hint: 'The order of the seats above, every game' },
]
export const STATUS_LABELS: Record<Run['status'], string> = {
  queued: 'Queued', playing: 'Playing', done: 'Done', cancelled: 'Cancelled', failed: 'Failed',
}
export const active = (status: Run['status']) => status === 'queued' || status === 'playing'
export const percent = (rate: number | null | undefined) => (rate == null ? '–' : `${Math.round(rate * 100)}%`)

// Whether this server has Forge, asked once per page load (AC-1).
const available = ref<boolean | null>(null)
let asked: Promise<void> | null = null
export function useForge() {
  asked ??= api.GET('/api/sims/status/').then(({ data }) => {
    available.value = data?.available ?? false
  })
  return available
}

/** "Playing 4 / 10", "Cancelling", "Cancelled by admin" … (spec 024 AC-16, spec 025 AC-15). */
export function statusLabel(run: Pick<Run, 'status' | 'played' | 'games' | 'cancelling' | 'cancelled_by'>) {
  if (run.status === 'playing') return run.cancelling ? 'Cancelling' : `Playing ${run.played} / ${run.games}`
  if (run.status === 'cancelled' && run.cancelled_by) return `Cancelled by ${run.cancelled_by}`
  return STATUS_LABELS[run.status]
}

/** Where a run's games play (spec 031, AC-2). */
export type ForgeChoice = Run['forge']
export const FORGE_CHOICES: { value: ForgeChoice; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Other while it answers, otherwise Main' },
  { value: 'main', label: 'Main', hint: "This server's Forge" },
  { value: 'other', label: 'Other', hint: 'The other Forge, e.g. a faster PC' },
]
export const forgeLabel = (value: ForgeChoice) => FORGE_CHOICES.find((f) => f.value === value)?.label ?? value
export const roleLabel = (role: string) => (role === 'main' ? 'Main' : role === 'other' ? 'Other' : '')

/** "42s", "4m 12s" ("4m" without seconds), "1h 05m" (spec 031, AC-7, AC-9). */
export function duration(ms: number, seconds = true): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  return seconds ? `${m}m ${total % 60}s` : `${m}m`
}

/** "Took 38m · games 1h 52m", or "Running 12m · games 25m" (spec 031, AC-9). */
export function runTime(run: Pick<Run, 'status' | 'started_at' | 'finished_at' | 'games_ms'>, now = Date.now()): string {
  if (!run.started_at) return ''
  const start = Date.parse(run.started_at)
  const games = `games ${duration(run.games_ms, false)}`
  if (run.status === 'playing') return `Running ${duration(now - start, false)} · ${games}`
  if (run.status === 'queued' || !run.finished_at) return ''
  return `Took ${duration(Date.parse(run.finished_at) - start, false)} · ${games}`
}
