# Card fixture

`scryfall-sample.jsonl` holds 58 real Scryfall card objects (one per line),
saved on 2026-11-01 from Scryfall's search API. The end-to-end tests load it
with `manage.py sync_cards --file` and fixed exchange rates, so expected
prices are exact and tests need no network.

Do not edit prices by hand: tests compute expectations from this file.

What the cards cover:

| Case | Cards |
| --- | --- |
| Many printings of one card | Lightning Bolt (8), Counterspell, Lightning Helix, … |
| Double-faced card | Delver of Secrets // Insectile Aberration |
| Split card | Fire // Ice |
| Etched-only printings (no EUR etched price) | Brotherhood Headquarters, Abstergo Entertainment |
| Nonfoil + foil + etched | Fire // Ice (MH2) |
| Foil-only printings | 5 printings |
| No EUR price | several Lightning Bolt printings |
| Multicolor / colorless | Lightning Helix, Fire // Ice / Sol Ring, Forest, … |
| Every card type except Battle | Creature, Instant, Sorcery, Enchantment, Artifact, Planeswalker, Land |
| Rarities | common, uncommon, rare, mythic, special |
| Must be skipped by the sync | a token (Giant) and two digital-only cards |
| Token makers and their tokens (spec 015) | Dockside Extortionist and Smothering Tithe (Treasure, two printings of one kind), Krenko, Mob Boss (Goblin); added 2026-11-07 |
| Combo pieces (spec 022) | Cloudstone Curio and Temur Sabertooth (each an infinite combo with Dockside Extortionist), Skirk Prospector (a Krenko combo piece); added 2026-11-10 |

## Card tags

`oracle-tags-sample.jsonl` is cut from Scryfall's `oracle_tags` bulk file
(2026-11-09): only the tags that `cards/tags.py` maps to categories and their
child tags, with taggings limited to the cards above. The tests load it with
`sync_cards --tags-file`.

## Combos

`spellbook-sample.json` is cut from Commander Spellbook's `variants.json.gz`
(2026-11-10): the two combos fully inside the cards above (Dockside
Extortionist with Cloudstone Curio and with Temur Sabertooth) and the 150 most
popular combos missing one or two of them, plus Krenko with Intruder Alarm and
Krenko, Skirk Prospector and Goblin Warchief. Card fields are trimmed to the
ones `cards/combos.py` reads. The tests load it with `sync_cards --combos-file`.

## Products (spec 030)

`backend/products/fixtures/mtgjson-printings-sample.json` and
`mtgjson-decks-sample.json` are cut from MTGJSON's `AllPrintings.json.xz` and
`AllDeckFiles.tar.xz` (2026-11-14). They keep 7 sets' booster types (FDN, MKM,
CMM, M21, SLZ, 2X2 and the online-only VMA) and 9 decks, with only the cards
from `scryfall-sample.jsonl`; each sheet keeps its real total weight, so the
chances per pack are the real ones. Arena and MTGO entries (FDN/MKM
`play-arena`, M21 `arena`, an Arena starter deck, an MTGO redemption) and VMA
are there to prove they are left out.
