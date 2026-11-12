# Spec 022: Deck insights

Status: Done
Depends on: 002-collection-polish, 004-decks, 006-deck-views, 012-ownership-labels, 021-deck-and-layout-polish
Followed by: 023-ui-polish, 024 (pod simulation, not written yet)

## Goal

Decks fill their own categories, show the combos they hold and the infinite
combos they are close to, and say how salty they are and which themes their
commander is played in. The app gets a dark theme.

## Terms

- **Tag**: a Scryfall Tagger oracle tag on a card ("ramp", "removal-exile").
  Tags form a tree; a tag also covers its child tags.
- **Combo**: a Commander Spellbook combo variant: the cards it uses, what it
  produces ("Infinite colorless mana"), its colour identity and steps.
- **Infinite combo**: a combo with a result named "Infinite …" or
  "Near-infinite …". (Commander Spellbook also marks locks and mass effects
  uncountable; those don't count.)
- **Win combo**: a combo whose result wins the game or makes opponents lose it.
- **Salt**: EDHREC's community score for how much players dislike playing
  against a card, 0 to 4. **Deck salt** is the sum over the deck's cards.
- **Counted cards**: Commander, Mainboard and Sideboard, as in deck stats.

## Acceptance criteria

### Categories

- **AC-1** A card added to a deck gets every category it matches, in this
  order: Ramp, Card draw, Removal, Board wipe, Counterspell, Tutor, Protection,
  Recursion, Tokens, Counters, Sacrifice, Graveyard, Lifegain, Burn, Evasion,
  Stax. The first is its primary category. This applies however it is added
  (Add card, import, scanner, from the collection, proposed as a swap) and in
  every zone. Lands and cards without matching tags get none.
- **AC-2** Categories come from Scryfall's tags, synced with the daily card
  sync. Each category is a fixed set of tags, child tags included
  (Lightning Bolt: Removal, Burn; Sol Ring: Ramp; Counterspell: Counterspell).
- **AC-3** The first tag sync replaces the categories of every card already in
  a deck with the automatic ones, lands included (they get none). Later syncs
  don't touch deck cards: categories you edit stay as you left them.
- **AC-4** Importing a list with tags (`1 Sol Ring #Fast`) gives a new card the
  list's tags instead of the automatic ones. A card already in the deck adds
  the tags to its own, as before.
- **AC-5** Moving a card between zones, swapping it in or changing its
  printing keeps its categories.

### Combos

- **AC-6** The deck page has a Combos tab, for the owner and for visitors of a
  public deck. The tab label has no count; each group shows its own.
- **AC-7** **In deck** lists every combo whose cards are all counted cards of
  the deck, infinite or not.
- **AC-8** **Could build** lists infinite and win combos that use at least one
  counted card and miss one or two cards. In a Commander deck the combo must
  fit the commander's colour identity; other formats have no colour limit.
  Combos missing one card come first, then the more popular ones. It shows 20
  and a Show more button for the next 20, up to 200.
- **AC-9** A combo shows its card images (missing ones dimmed, with the
  ownership badge when you own a copy), what it produces, an Infinite and/or
  Win badge, and a link to the combo on Commander Spellbook. Clicking Steps
  opens its prerequisites and steps, and any extra pieces it needs ("a
  creature with power 3 or more").
- **AC-10** For the owner, a missing card has an Add button that puts it in
  the Maybeboard. Clicking any combo card opens its card dialog; one not in the
  deck opens without the deck section, so the owner can add it to the deck or
  the want list from there.
- **AC-11** Combo data comes from Commander Spellbook's dataset, synced daily.
  The tab credits Commander Spellbook with a link. With nothing to show a
  group says "No combos."

### Salt

- **AC-12** The Stats tab has a Salt card: the deck salt with one decimal, a
  meter from 0 to 72 with a mark at the average deck (36), and a tooltip that
  lists the five saltiest counted cards with their scores.
- **AC-13** The deck header shows "Salt 41" (rounded) after the legality badge.
  Clicking it opens the Stats tab. A deck without counted cards shows no salt.
- **AC-14** Salt scores come from EDHREC. A card's score is fetched the first
  time a deck needs it, kept, and refreshed after 30 days. Cards EDHREC has no
  score for count as 0.

### Commander themes

- **AC-15** A Commander deck with a commander shows up to 8 EDHREC themes for
  it in the Stats tab ("Goblins", "Tokens" …), most played first, each linking
  to that theme on EDHREC. With partners, the themes of the pair. Without a
  commander or without EDHREC data the card is hidden.

### Dark theme

- **AC-16** Settings has an Appearance card with Theme: Light, Dark or System.
  System is the default and follows the device. The choice applies at once,
  is saved in this browser, and applies on reload without a light flash, on
  every page including Log in.
- **AC-17** Every page is readable in the dark theme: no light panels, and
  badges, charts, binder pockets and dialogs use dark colours.

## Out of scope

- Simulating Commander pods (spec 024-pod-simulation)
- An Auto-categorize button or recomputing categories after the first sync
- Combos missing three or more cards, or needing a colour or commander change
- Salt on deck tiles in the Decks list
- Themes for decks without a commander
- Saving the theme on the account

## Assumptions (filled in during writing, not grilled)

- AC-1: the category tags are listed in the plan. A double-faced card whose
  front is a land counts as a land.
- AC-3: "first tag sync" is the first successful tag sync on this server; a
  fresh install runs it with its first card sync.
- AC-7, AC-8: only counted cards take part; Maybeboard cards don't. A combo whose card must be the commander is matched like any other.
- AC-8: popularity is Commander Spellbook's (decks on EDHREC playing it).
- AC-9: "you own a copy" is any copy in your collection, as the ownership
  badge counts it; visitors see no badge.
- AC-12: a card counts once, whatever its quantity.
- AC-14: scores are fetched while the deck page loads; the header shows the
  sum of the scores known so far and updates when the rest arrive.
