# Spec 015: Deck tokens

Status: Done
Followed by: 021-deck-and-layout-polish
Depends on: 004-decks, 006-deck-views, 014-export-options

## Goal

A deck shows the tokens and other extra pieces its cards make, so you know
what to bring to the table.

## Acceptance criteria

### Catalog

- **AC-1** The card sync keeps what Scryfall lists as a card's token parts:
  tokens, emblems, The Monarch, The Initiative, dungeons and the like. They
  never appear in card search, the collection or the scanner.

### Deck

- **AC-2** The Deck tab ends with a **Tokens (N)** group in every view (Text,
  List, Images): one tile per kind of token made by a Commander, Mainboard or
  Sideboard card. N counts the kinds. With no tokens the group doesn't show.
- **AC-3** A tile shows the token's image. Hovering shows it large with the
  names of the deck cards that make it; clicking opens it full screen. The art
  comes from the first maker's printing (makers sorted by name).
- **AC-4** Search and filters narrow the group to the tokens of the cards
  shown.
- **AC-5** Visitors see the group on a public deck too.
- **AC-6** Tokens count toward nothing: deck size, value, stats and legality
  ignore them.

### Card dialog

- **AC-7** A card's dialog lists the tokens its printing makes, as small
  images with the same hover and full screen.

### Export

- **AC-8** Deck Export has a **Tokens** checkbox, off by default and
  remembered. Ticked, the list ends with a `Tokens` section, one line per kind:
  `1 Treasure (TCLB) 12`, or `1 Treasure` with Printings off.

## Out of scope

- Owning tokens in the collection
- Token prices

## Assumptions (filled in during writing, not grilled)

- "Kind" means the token's Scryfall oracle id (every Treasure is one kind).
- A token part that Scryfall files as a normal card (some dungeons) shows like
  any token.
- Tokens arrive with the next card sync after an update.
