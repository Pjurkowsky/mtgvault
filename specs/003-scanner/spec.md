# Spec 003: Card scanner

Status: Done
Depends on: 001-collection, 002-collection-polish
Followed by: 004-binder-view

## Goal

Add cards by holding them in front of a camera. Recognized cards land in a
cart, a staging area outside the collection, and from there move into
locations (or, in a later spec, a want list).

Recognition reuses manavault's published card-recognition models
(cfbender/manavault scanner bundles, trained in cfbender/oracle, both
MPL-2.0) and runs in the browser.

## Terms

- **Model bundle**: one published version of the recognition models
  (detector, embedding, gallery search, and the gallery of artworks).
- **Cart**: one per user. Holds scanned cards that are not yet part of the
  collection.
- **Logging a card**: the scanner adding a recognized card to the cart.

## Acceptance criteria

### Opening the scanner

- **AC-1** The collection toolbar (All cards, location pages, cart) has a
  camera button that opens the scanner as a full-screen camera view with
  floating controls.
- **AC-2** The scanner asks for camera access and prefers the rear camera.
  When access is blocked, no camera exists, or the page isn't secure, it says
  so and how to fix it.
- **AC-3** The first time a model version is used, the scanner shows download
  progress. Later openings load it from the browser's cache.
- **AC-4** After 60 seconds without a card in view, the camera pauses until
  the user taps. The camera also stops while the tab is hidden.

### Recognition and logging

- **AC-5** Holding a card still in view logs it without a tap. A card that is
  moving or blurred is not logged.
- **AC-6** The same card is not logged twice in a row. "+1" adds another copy
  of the last logged card.
- **AC-7** A status line says what the scanner sees: no card, a card it is
  still identifying ("Hold steady"), or the card it just logged.
- **AC-8** With locked sets chosen, only cards printed in those sets are
  logged. A card clearly from another set shows "Not in locked sets".
- **AC-9** The logged printing is, in order: one from a locked set, the
  printing whose artwork matched, a printing the user owns, the newest
  English non-promo printing.
- **AC-10** A logged card is nonfoil (or the printing's only finish), Near
  Mint and English.

### Result bar

- **AC-11** After a log, a bar shows the card's image, name, set and price
  (spec 002 price tooltip), with: a finish toggle, "+1", "Change printing"
  (opens the edit dialog), and "Undo" (removes that copy from the cart).

### Settings

- **AC-12** A scanner settings sheet has: sounds on/off, the two sound
  thresholds, running total on/off, and locked sets (searchable list of
  sets).
- **AC-13** Sounds: a click for every logged card, a ding when its price is at
  least the low threshold, a bigger ding from the high threshold. Defaults 1
  and 10 in the user's currency.
- **AC-14** The running total shows the cart's card count and value.
- **AC-15** Scanner settings are saved to the account.
- **AC-16** The Settings page has "Fast scanning" (off by default). When on,
  the scanner opens in a mode that lets recognition use several threads where
  the browser supports it. The scanner settings sheet shows how many threads
  recognition uses.

### Cart

- **AC-17** Each user has one cart. Logged cards go into it, and identical
  rows merge (spec 001 AC-19).
- **AC-18** Cart cards are not part of the collection: they don't appear in
  All cards, Unfiled, location totals, collection exports, public pages or
  the directory.
- **AC-19** The Locations tab has a Cart tile with its card count and value,
  linking to the cart page. The scanner links to the cart too.
- **AC-20** The cart page uses the card browser: views, search, filters,
  sort, selection, edit (without a location field), delete and export. It has
  no Add card or Import.
- **AC-21** "Move to" sends the selected cards, or all of them, to a location
  or Unfiled. They leave the cart and merge with matching rows there.
- **AC-22** "Move to want list" shows on the cart page, disabled.

### Model updates

- **AC-23** The server installs the newest published manavault scanner
  bundle daily, and on demand with a command. It checks every file's SHA-256
  and keeps the previous version if anything fails.
- **AC-24** Browsers download each model version once and reuse it from
  their cache until a new version is installed.
- **AC-25** Code ported from manavault keeps its MPL-2.0 notice, and the
  README credits manavault and oracle.

## Out of scope

- Identifying a card by name inside the scanner
- Tokens
- Uploading training data, outline correction
- Camera preview zoom and pan, choosing a camera, "prefer foil"
- The want list itself

## Assumptions (filled in during writing, not grilled)

- New cart rows are Near Mint, English, nonfoil where possible (AC-10).
- "Undo" removes one copy; the row goes away at zero (AC-11).
- The scanner works with any camera, laptop webcams included.
- Tests use Chromium's fake camera fed with a card image, and download the
  model bundle once (not committed to git).
