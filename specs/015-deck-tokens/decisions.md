# Spec 015: Deck tokens (decisions so far)

Status: Written into spec.md (2026-11-07).

## Request

- "to decks add tokens that this deck produces"

## Research

- Scryfall card objects list related cards in `all_parts`; tokens (and
  emblems, The Monarch, dungeons and the like) have `component: "token"` with
  the token's Scryfall id, name and type line. Example: Dockside Extortionist →
  Treasure (Token Artifact — Treasure).
- The card sync (`cards/scryfall.py`, `SKIPPED_LAYOUTS`, `should_skip`) drops
  tokens, emblems and art series, and stores no `all_parts`. So tokens need a
  catalog change: store each printing's token ids and keep token cards (their
  name, type line, images) out of card search and the collection.
- Tokens arrive with the next card sync (nightly) after deploying; until then
  decks show none.
- The e2e fixture (`cards/fixtures/scryfall-sample.jsonl`) has one token
  (Giant) and no card with `all_parts`; tests need real Scryfall objects for a
  token maker and its tokens (the Scryfall API is reachable to fetch them).

## Grilling (2026-11-07)

- Round 1: a Tokens group at the end of the Deck tab, in every view; tokens of
  Commander, Mainboard and Sideboard cards; everything Scryfall lists as a token
  part (tokens, emblems, The Monarch, The Initiative, dungeons); one tile per
  token with its image, the hover preview lists the cards that make it, click
  opens it full screen.
- Round 2: the group follows search and filters (tokens of the cards shown);
  one tile per kind of token, art from the first maker's printing; also on the
  public deck page and in the card dialog; deck Export gets a Tokens checkbox,
  off by default; tokens count toward nothing (deck size, value, stats).
