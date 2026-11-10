# Spec 022: Deck insights (decisions so far)

Status: Grilling (2026-11-10). Written into spec.md when done.

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
