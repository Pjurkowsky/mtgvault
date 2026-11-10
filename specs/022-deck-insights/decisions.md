# Spec 022: Deck insights (decisions so far)

Status: Written into spec.md (2026-11-10).

## Requests

1. "it should auto categorize your cards check if it is possible so like theme to cards"
2. "search if there is a possible way to simulate for example commander pods to
   get some stats how your deck is doing (i would like to use some ready to use thing)"
3. "check decks for combos (i think just inifinity, use some tool for that)"
4. "add salt meter to decks"
5. "add a dark theme to settings"

## Research

### The code now

- Deck cards already have free-text categories (spec 006 AC-12 to AC-15):
  `DeckCard.categories`, first one is primary, "By category" grouping, export as
  `#Tag`. Auto-categorising can fill these.
- `backend/cards/edhrec.py` already reads EDHREC's card JSON (cached 24 h, with
  fixtures for tests in `backend/cards/fixtures/edhrec/`). The trimmed fixture
  has no salt field.
- Dark mode: `style.css` already has the shadcn `.dark` variables and the
  `dark` custom variant. Nothing toggles the class. About 13 hard-coded colours
  outside `components/ui`, mostly black overlays (scanner, fullscreen card)
  that are fine in both themes.
- Settings stores currency on the user (`User.currency`); fast scanning is a
  device setting.

### Outside tools (checked 2026-11-10)

| Request | Tool | What it gives | Notes |
|---|---|---|---|
| Categorise | Scryfall `oracle_tags` bulk file | 4,617 Tagger tags, 240k taggings by `oracle_id`, daily, 6 MB gz | Direct taggings only: parents (removal, draw) need their children walked. Key on tag UUID. Community data |
| Deck themes | EDHREC commander JSON `panels.taglinks` | Themes for a commander with deck counts (Atraxa: Infect, +1/+1 Counters) | Unofficial JSON, already used |
| Simulate pods | Forge 2.0.15 `forge.sh sim -d a.dck b.dck c.dck d.dck -f commander -n N -c 300` | Winner per game on stdout; turn from the log | GPL-3, Java 17, headless works. Separate container. AI plays combos/politics poorly. Tens of seconds to minutes a game. XMage has no AI-vs-AI CLI |
| Combos | Commander Spellbook `POST /find-my-combos` | Combos included / almost included; features with `uncountable` = infinite, "Win the game" | MIT, ~80 req/min, credit them. Bulk `variants.json.gz` 32 MB daily |
| Salt | EDHREC card JSON `container.json_dict.card.salt` | 0 to 4 per card | No bulk file (top 100 only). Deck salt is usually the sum; average deck about 36 |

## Round 1

- Pod simulation: its own spec (023), not this one.
- Categorising: automatic when a card is added to a deck, and existing deck
  cards get categories too (not just a button).
- Combos: every combo in the deck, not only infinite ones, plus combos you could
  have because you own the missing card.
- Theme: Light / Dark / System, saved on this device, System by default.

## Round 2

- Existing categories: replace all (auto categories replace the ones typed so far).
- Several matches: a card gets every matching category, in a fixed priority
  order, so the primary is the most useful.
- Combos: a separate deck tab. It scans every card in the deck and shows the
  combos already in the deck, and the infinite combos a deck card takes part
  in that you could build.
- Salt: the sum of card salt, shown as a meter against the average deck, with
  a tooltip listing the saltiest cards.

## Round 3

- Replacing: once, when this ships. No Auto-categorize button. After that a
  card gets its categories when it is added to a deck, and your edits stay.
- Combos you could build: missing up to two cards (so the daily Spellbook
  dataset, matched locally).
- Could build lists infinite or win-the-game combos only. In deck lists every combo.
- Deck themes: show the commander's EDHREC themes.

## Round 4

- Fit: in Commander decks the missing cards must be in the commander's colour
  identity; other formats have no colour limit. Owned missing cards get the
  ownership badge.
- Combo row: card images (missing ones dimmed, with Add), what it produces,
  Infinite/Win badges, steps opened on click, link to Commander Spellbook.
- Categories, in priority order: Ramp, Card draw, Removal, Board wipe,
  Counterspell, Tutor, Protection, Recursion, Tokens, Counters, Sacrifice,
  Graveyard, Lifegain, Burn, Evasion, Stax. Lands get none. Every zone.
- Placement: salt meter and theme chips (linking to EDHREC) in the Stats tab;
  a small salt number by the legality badge in the deck header opens Stats.
