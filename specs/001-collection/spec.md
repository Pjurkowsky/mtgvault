# Spec 001: Collection

Status: Done
Depends on: 000-accounts
Followed by: 002-collection-polish, 004-binder-view

> Spec 002 replaces AC-3, AC-26, AC-29 (tiles), AC-32, AC-35 (summary) and
> AC-38. See [its table](../002-collection-polish/spec.md#replaces-in-spec-001).

## Goal

Let a user record every Magic card they own, where each copy is stored, and
what it is worth. Keep the interface minimal: the reference app (manavault)
felt crowded, and its filtering and selection worked differently from screen
to screen.

## Principles

- **P-1 Minimal UI.** Build screens from stock shadcn-vue components. Add a
  control only when an acceptance criterion needs it.
- **P-2 One card browser.** One shared component handles search, filters,
  sorting, view toggle, selection and bulk actions. All Cards, location pages
  and public location pages use it, and later specs (decks, binder) reuse it.
  Those features must never get a second implementation.
- **P-3 No deck links.** Nothing in this spec connects to decks.
- **P-4 No obvious text.** Skip headings, taglines and helper lines that repeat
  what a label or button already says. Useful context that isn't obvious goes
  in an info-icon tooltip (`InfoTip`), not on the page. Errors show as a
  destructive alert with a tinted background.

## Terms

- **Printing**: one specific version of a card (set + collector number), as
  listed by Scryfall.
- **Collection row**: one line in the collection: a printing, finish,
  condition, language and location, with a quantity.
- **Location**: a named place where physical cards live.
- **Unfiled**: built-in group for rows with no location.

## User stories

- As a user, I create locations for my binders and boxes, and see how many
  cards each holds and what they are worth.
- As a user, I add a card in one dialog: find it, pick the printing, set the
  details, choose where it goes.
- As a user, I browse all my cards or one location's cards with the same
  search, filters, sorting and selection.
- As a user, I select many cards and move, edit, export or delete them at once.
- As a user, I paste a card list to import it, and export my cards as a list.
- As a user, I see prices in my chosen currency.
- As a user, I make some locations public so other people can see them.
- As anyone, I browse a directory of users and look at their public locations.

## Acceptance criteria

### Card catalog and prices

- **AC-1** The app keeps a local copy of Scryfall's card data (every printing
  with its name, set, collector number, image, colors, type line, mana value,
  rarity, available finishes and prices). It refreshes daily.
- **AC-2** Prices come from Scryfall: USD (TCGplayer) and EUR (Cardmarket),
  separately for nonfoil, foil and etched.
- **AC-3** PLN prices equal the EUR price multiplied by the latest daily EUR→PLN
  rate from the Polish central bank (NBP). The app labels PLN prices as
  estimates.
- **AC-4** Every price shows in the user's selected currency (spec 000).
- **AC-5** When a printing has no price for a finish, the app shows "–" and
  counts it as 0 in totals.
- **AC-6** If a daily refresh fails, the app keeps the previous data. The card
  browser shows the date prices were last updated.

### Locations

- **AC-7** A location has a name, a kind (Binder, Box or Deck box) and a
  visibility (Private or Public). New locations are Private.
- **AC-8** Location names are unique per user, ignoring case.
- **AC-9** The Locations page lists the user's locations plus Unfiled. Each
  shows its name, kind icon, visibility, total card count (sum of quantities)
  and total value in the user's currency.
- **AC-10** The user can create, rename, change kind and change visibility of a
  location.
- **AC-11** Deleting a location asks what to do with its cards: move them to
  another location, make them Unfiled, or delete them. The dialog shows how
  many cards are affected. An empty location deletes after a plain confirm.
- **AC-12** Unfiled cannot be renamed, deleted or made public.
- **AC-13** Opening a location shows its cards in the card browser, with the
  location name, kind and totals above it.

### Collection rows

- **AC-14** A collection row records: printing, quantity (1 to 999), finish,
  condition, language, purchase price per copy (optional, with its currency),
  location (or Unfiled), date added, and the USD, EUR and PLN market price per
  copy at the moment of adding.
- **AC-15** Finish options are limited to the finishes the printing exists in.
- **AC-16** Conditions: Near Mint, Lightly Played, Moderately Played, Heavily
  Played, Damaged. Default: Near Mint.
- **AC-17** Languages are the languages Scryfall uses. Default: English.
- **AC-18** Purchase price is stored in the currency the user typed it in. The
  app shows it converted to the user's current currency, using the latest
  rates.
- **AC-19** Two rows with the same printing, finish, condition, language and
  location never coexist. Adding, importing, moving or editing into a match
  merges the rows: quantities add up, purchase price becomes the average per
  copy (weighted by quantity), and the older row's date added and
  price-when-added stay.
- **AC-20** If merging rows with purchase prices in different currencies, the
  app converts the incoming price into the existing row's currency before
  averaging. A row with no purchase price does not affect the average.

### Add a card

- **AC-21** "Add card" opens one dialog. Typing a name (at least 2 characters)
  searches the catalog and lists matching cards.
- **AC-22** Choosing a card shows its printings as images, newest first, with
  set name and collector number. The newest printing starts selected.
- **AC-23** The same dialog holds: quantity (default 1), finish (default
  nonfoil, or the only finish available), condition, language, purchase price
  and currency (defaults to the user's currency), and location.
- **AC-24** Location defaults to the location the user is viewing, otherwise
  Unfiled.
- **AC-25** "Add" saves the row (merging per AC-19), shows a confirmation toast,
  and keeps the dialog open with the search cleared so the user can add the
  next card.

### Edit and delete a card

- **AC-26** Clicking a card opens its detail: large image, card name, set,
  printing details, all row fields, current price and price when added.
- **AC-27** From the detail the user edits any row field, including switching to
  another printing of the same card. If the edit makes the row match another,
  they merge per AC-19 and the user sees a note saying so.
- **AC-28** The user deletes a row from the detail after confirming.

### Card browser (shared component, see P-2)

- **AC-29** The browser has a Grid view (card images with a quantity badge) and
  a Table view (image thumbnail, name, set, collector number, finish,
  condition, language, quantity, price, location). A toggle switches them. The
  app remembers the choice per browser.
- **AC-30** Search matches card name, ignoring case, as the user types.
- **AC-31** Filters: color (any of W, U, B, R, G, colorless), card type,
  rarity, set (one or more), finish, condition, price range in the user's
  currency. All active filters combine with AND.
- **AC-32** Active filters show as removable chips, plus "Clear all".
- **AC-33** Sort options: name, set, rarity, price, quantity, date added, color
  (WUBRG order), mana value. Each sorts ascending or descending. Default: name
  ascending.
- **AC-34** Search, filters, sort and view live in the URL. Back/forward and
  reloading restore them, and a copied link opens the same view.
- **AC-35** The browser loads more cards as the user scrolls. It shows the
  number of matching rows and total quantity.
- **AC-36** With 20,000 rows in a collection, the first results show within
  1 second of changing search, filters or sort.
- **AC-37** All Cards shows every row the user owns across locations and
  Unfiled, in this browser.

### Selection and bulk actions

- **AC-38** "Select" turns on selection mode. Clicking a card toggles it.
  Shift-click selects a range.
- **AC-39** "Select all" selects every row matching the current search and
  filters, including rows not loaded yet. The bar shows "N selected".
- **AC-40** Changing search or filters keeps the selection. A "Clear selection"
  button empties it.
- **AC-41** Bulk actions on the selection: move to location (or Unfiled), edit
  fields (condition, language, finish), export, delete. Each one shows a
  confirm step with the number of rows and cards affected.
- **AC-42** Bulk finish edits skip rows whose printing lacks that finish and
  report how many were skipped.
- **AC-43** Bulk move and bulk edit merge rows per AC-19.
- **AC-44** Selection and bulk actions work the same in All Cards and on
  location pages.

### Import

- **AC-45** "Import" accepts pasted text or an uploaded `.txt` file.
- **AC-46** Each line follows `<qty> <name> (<SET>) <collector#> <finish>`.
  Only the name is required. Quantity defaults to 1. `*F*` means foil, `*E*`
  etched, no marker nonfoil. Without set and number, the newest printing is
  used. Blank lines and lines starting with `#` or `//` are ignored.
- **AC-47** Before importing, the user chooses the target location and default
  condition, language, and optional purchase price per copy with currency.
- **AC-48** The preview lists every recognized row (image, name, printing,
  finish, quantity) and every unrecognized line with its line number and the
  reason. Nothing saves before the user confirms.
- **AC-49** Confirming imports the recognized rows in one step (all or
  nothing), merging per AC-19, and reports how many cards were added.
- **AC-50** Imports of up to 5,000 lines work.

### Export

- **AC-51** "Export" on a browser exports every row matching the current search
  and filters. Bulk "Export" exports the selection.
- **AC-52** Export writes the AC-46 format, one line per row, and offers copy to
  clipboard and download as `.txt`.
- **AC-53** Exporting then importing the result reproduces the same printings,
  finishes and quantities.

### Public locations and directory

- **AC-54** The directory at `/users` lists users with at least one public
  location, by username, with a username search. Anyone can open it, logged in
  or not.
- **AC-55** A user's profile (`/u/<username>`, spec 000) lists their public
  locations with name, kind, card count and total value.
- **AC-56** A public location page shows its cards in the card browser in
  read-only mode: views, search, filters and sort work, while selection, bulk
  actions, add, edit and delete are hidden. Export stays available.
- **AC-57** Visitors see image, name, printing, quantity, finish, condition,
  language and market price. Purchase price and price when added never leave
  the server for anyone except the owner.
- **AC-58** Visitors see prices in their own currency when logged in, USD
  otherwise.
- **AC-59** Opening a private location's URL as anyone except its owner shows
  "Not found", the same response as a missing location.
- **AC-60** Making a location private removes it from the profile and the
  directory immediately.

## Out of scope (later specs)

- Binder view: grid size, spreads, card positions, page sections (spec 004)
- Decks and reserving copies for decks
- Tokens
- Value dashboard, gains and losses
- CSV import/export and other apps' formats (ManaBox, Moxfield)
- Card scanner
- Location cover cards, stickers, descriptions
- Notes on rows

## Assumptions (filled in during writing, not grilled)

- Conditions list and Near Mint default (AC-16).
- Quantity range 1 to 999; lowering to 0 is not allowed, delete instead
  (AC-14).
- "Add" keeps the dialog open for the next card (AC-25).
- Unfiled is always private (AC-12).
- Filters, sort and view live in the URL (AC-34).
- Logged-out visitors see USD (AC-58).
- Limits and timings: 20,000 rows within 1 second (AC-36), 5,000 import lines
  (AC-50).
- Plain-text export does not carry condition, language or prices, so rows that
  differ only in those print as separate lines with the same text (AC-52).
