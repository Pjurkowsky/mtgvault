import { ref } from 'vue'
import { api, type Schemas } from '@/api/client'

/** Pod simulation with Forge (spec 024). */
export type Run = Schemas['Run']
export type Opponent = Schemas['Opponent']
export type QueueEntry = Schemas['QueueEntry']
export type Profile = 'Default' | 'Cautious' | 'Reckless' | 'Experimental'
export type SeatMode = 'rotate' | 'random' | 'fixed'

export const PROFILES: Profile[] = ['Default', 'Cautious', 'Reckless', 'Experimental']
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
