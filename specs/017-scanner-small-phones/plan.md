# Plan 017: Scanner on small phones, reliable sound

Spec: [spec.md](spec.md)

| Topic | Choice |
|---|---|
| Top bar | `ScanPage`: destination link `min-w-0` with a truncated label and a `shrink-0` total; binder slot `truncate`; Change buttons become `IconButton` (`ArrowLeftRightIcon`, "Change target", "Change slot"); settings `shrink-0`. |
| Result bar | `ResultBar`: thumbnail `h-16` below 400px (`max-[399px]:`); Change printing and Undo labels `max-[399px]:sr-only` inside a tooltip. |
| Full screen | `style.css`: `html:has([data-testid="scanner"]) { scrollbar-gutter: auto }`. |
| Sound | `scanner/sounds.ts`: `installAudioUnlock()` from `main.ts` listens (capture) for the first `pointerdown`/`keydown`/`touchend`, makes and resumes the context and plays a silent buffer (iOS). `playSound` awaits `resume()` when the state isn't `running` and schedules from the clock after it; `visibilitychange` resumes too. |
| Tests | `scanner-small.spec.ts` (scanner project): 320px layout in all three modes; tones start with the context running. |
