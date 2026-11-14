# Plan 032: Products to buy fixes

## Decisions

| Topic | Choice |
|---|---|
| Sections | New `Product.section`: `precons`, `boosters`, `other_decks`, `other_boosters`, set at sync time. Precon: deck type Commander Deck. Booster: key in play, draft, set, collector, default and not a sealed pack of under 14 cards. |
| Photo | New `Product.image` (URL). The sync reads each set's `sealedProduct`: booster packs link to a booster key through `contents.pack[].code`, decks through the deck's `sealedProductUuids`. Image: `https://tcgplayer-cdn.tcgplayer.com/product/<tcgplayerProductId>_200w.jpg`. |
| Commander | New `ProductCard.commander`, set from the MTGJSON deck's `commander` zone. The API returns `commanders` (printings) per deck entry. |
| API | `GET …/products/` returns `{synced, cards, sections: {precons, boosters, other_decks, other_boosters}, none}`; entries `{product (with image), count, commanders, cards}`; cards keep `copies` and `chance`. Basic lands (type line starts with "Basic") are dropped from the wanted cards. Ranking by count, then newer. |
| Dialog | Four tabs; rows with an image (commander or photo); expanded cards as an image grid grouped by type with `CardSizeToggle` (`products.size`), `CardPreview` on hover, chance or ×N badges. |

## Files

| File | Change |
|---|---|
| `backend/products/models.py`, migration | `section`, `image`, `ProductCard.commander` |
| `backend/products/sync.py` | sealed products, sections, images, commanders |
| `backend/products/deck.py` | sections, basic lands, commanders, ranking |
| `backend/products/serializers.py` | sections, image, commanders |
| `backend/products/fixtures/` | sealed products, commanders, a basic land in a precon |
| `frontend/src/components/decks/ProductsDialog.vue` | tabs, images, card grid |
| `frontend/src/pages/ProductPage.vue` | product photo |
| `frontend/src/lib/decks.ts` | export the type grouping |

## Tests

| Test file | ACs |
|---|---|
| `e2e/products.spec.ts` | AC-1 to AC-7 (with spec 030's ACs updated) |

## Order of work

1. Models, sync and fixture.
2. API.
3. Dialog.
4. Tests, full suite, READMEs, status.
