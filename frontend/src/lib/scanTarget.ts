/** Where a deck's scans go, remembered per deck in this browser (spec 005, AC-16). */
export type ScanTarget =
  | { kind: 'cart' }
  | { kind: 'location'; location: number | null; binder?: { page: number; row: number; col: number; direction: 'rows' | 'columns' } } // null = Unfiled; binder = scan in order (spec 007)
  | { kind: 'deck'; deck: number } // the decklist only

const key = (deckId: number) => `mtgvault.scan.deck.${deckId}`

export function loadScanTarget(deckId: number): ScanTarget | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(deckId)) ?? 'null')
    if (value?.kind === 'cart') return { kind: 'cart' }
    if (value?.kind === 'location' && (value.location === null || typeof value.location === 'number')) return value
    if (value?.kind === 'deck') return { kind: 'deck', deck: deckId }
  } catch {
    /* blocked or broken storage: ask again */
  }
  return null
}

export function saveScanTarget(deckId: number, target: ScanTarget) {
  try {
    localStorage.setItem(key(deckId), JSON.stringify(target))
  } catch {
    /* the choice still applies to this visit through the URL */
  }
}

/** Open the scanner for a deck; Fast scanning needs a full load of the isolated page (spec 003, AC-16). */
export function scannerUrl(deckId: number, fast: boolean) {
  return `${fast ? '/scan/fast' : '/scan'}?deck=${deckId}`
}
