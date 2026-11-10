# Plan 022: Deck insights

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Card data | New `cards.CardInsight` keyed by `oracle_id`: `categories` (array), `salt` (decimal, null), `salt_checked_at`. |
| Tag sync | `cards/tags.py`: `sync_tags(file)` reads Scryfall's `oracle_tags` bulk file (JSONL gz, found through `/bulk-data`), walks child tags, and writes each oracle's categories in `CATEGORY_TAGS` order. Tags keyed by UUID, slug in a comment. Lands (`'Land' in types` of any printing's front) get none. New `SyncRun.Kind.TAGS`. |
| First sync | `sync_tags` checks for an earlier successful TAGS run; if none, `recategorize_all()` rewrites every `DeckCard.categories`. |
| On add | `services.auto_categories(oracle_id)`. `add_card(..., categories=None)`: a new card gets `categories or auto`; an existing one merges `categories`. `maybe_card` uses it too. Import passes the row's tags. |
| Combo data | `cards.Combo` (`id` str, `card_ids` uuid array, `produces` array, `infinite`, `wins`, `identity`, `popularity`, `description`, `prerequisites`, `requires` array) and `cards.ComboCard` (`combo`, `oracle_id`, `name`, `image`, indexed on `oracle_id`). `cards/combos.py`: `sync_combos(file)` replaces both tables from `variants.json.gz` (status OK only), in one transaction. Daily beat task. |
| Matching | `combos.deck_combos(deck, cards, ctx)`: ComboCard rows for the deck's counted oracle ids → combo ids with matched counts; in deck: missing 0; could build: missing 1–2 and (infinite or wins) and identity ⊆ commander identity (Commander decks). Ownership from `deck_ownership`-style lookup of collection copies by oracle. |
| Combo API | `GET /api/decks/{id}/combos/` and `GET /api/users/{u}/decks/{id}/combos/` → `{in_deck, could_build}`; each combo `{id, cards:[{oracle_id, name, image, in_deck, owned, printing?}], produces, infinite, wins, description, prerequisites, requires, url}`. Deck detail gains `combo_count`. |
| Salt | `cards/edhrec.py`: `_fetch(path)` for `cards/` and `commanders/` pages; `salt_for(names)` fetches missing or stale scores with 8 threads and saves them. Deck detail `salt: {total, top, pending}` from stored scores. `GET /api/decks/{id}/insights/` (and public) fetches pending scores and commander themes (cached 24 h) and returns `{salt, themes}`. |
| Themes | `commander_themes(names)`: slug of the commander (partners: both slugs sorted and joined), `panels.taglinks` top 8, link `https://edhrec.com/commanders/{slug}/{theme}`. |
| Fixtures | `scryfall-sample.jsonl` gains Cloudstone Curio, Temur Sabertooth, Skirk Prospector. New `oracle-tags-sample.jsonl` (real tags for fixture cards, trimmed) and `spellbook-sample.json` (real variants touching fixture cards). EDHREC fixtures gain `card.salt` for a few cards and `commanders/krenko-mob-boss.json`. Playwright's webServer runs `sync_cards --tags-file … --combos-file …`. |
| Theme | `lib/theme.ts`: `Theme = 'light' \| 'dark' \| 'system'`, stored in `localStorage['theme']`, applies `.dark` on `<html>` and follows `prefers-color-scheme` for System. An inline script in `index.html` sets the class before the app loads. Settings gets an Appearance card with a Select. |
| Dark colours | Replace hard-coded light colours (`bg-white`, `text-emerald-600`, amber badges …) with tokens or `dark:` variants; check every page by screenshot. |

## Files

| File | Change |
|---|---|
| `backend/cards/models.py`, migration | `CardInsight`, `Combo`, `ComboCard`, `SyncRun.Kind.TAGS`, `COMBOS` |
| `backend/cards/tags.py` (new) | category map, `sync_tags`, `recategorize_all` |
| `backend/cards/combos.py` (new) | `sync_combos`, `deck_combos` |
| `backend/cards/edhrec.py` | page paths, salt, commander themes |
| `backend/cards/tasks.py`, `management/commands/sync_cards.py`, `config/settings.py` | tags with the card sync, `--tags-file`, `--combos-file`, combo beat task, salt refresh |
| `backend/cards/fixtures/*` | fixture cards, tags, combos, EDHREC salt and commander |
| `backend/decks/services.py`, `views.py`, `serializers.py`, `urls.py` | auto categories, combos, insights, salt in detail |
| `backend/openapi.yaml`, `frontend/src/api/schema.d.ts` | regenerated |
| `frontend/index.html`, `src/lib/theme.ts` (new), `src/main.ts`, `pages/SettingsPage.vue` | theme |
| `frontend/src/pages/DeckPage.vue` | Combos tab, salt in header, insights load |
| `frontend/src/components/decks/DeckCombos.vue`, `ComboRow.vue` (new) | Combos tab |
| `frontend/src/components/decks/DeckSalt.vue`, `DeckThemes.vue` (new), `DeckStats.vue` | Stats cards |
| components with hard-coded colours | dark variants |

## Tests

| File | Covers |
|---|---|
| `deck-auto-categories.spec.ts` | AC-1 to AC-5 |
| `deck-combos.spec.ts` | AC-6 to AC-11 |
| `deck-salt.spec.ts` | AC-12 to AC-15 |
| `dark-theme.spec.ts` | AC-16, AC-17 |
| Updated: `deck-categories.spec.ts`, `deck-import.spec.ts`, `export-options.spec.ts`, others that expect no categories on new cards | AC-1 |

## Order of work

1. Card insight model, tag sync, auto categories, first-sync replace.
2. Combo sync and matching, API, Combos tab.
3. Salt and themes backend, Stats cards, header.
4. Dark theme setting, then dark colours page by page.
5. Full suite, READMEs, spec status.
