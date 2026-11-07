# Plan 011: Deck and add polish

Spec: [spec.md](spec.md)

## Decisions

| Topic | Choice |
|---|---|
| Backend | No changes. Printings already carry `prices[finish]`. |
| List side image | `DeckList` gets a `md:grid-cols-[13rem_1fr]` layout with a sticky `<img data-testid="deck-preview">`; rows set the shown card on `pointerenter` and `focus`. `CardPreview` is dropped from List rows. |
| Text view preview on focus | `CardPreview` gets an `openOnFocus` prop: focus opens it at once, blur closes it. `DeckText` sets it. |
| Swaps | `DeckSwaps` rows use `grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto]`; the out side is right-aligned with its image last; the trash is an `IconButton` labelled Remove. `DeckPage.removeCard` already confirms. |
| Add dialog | `CardSearch` results live in a `h-[26rem] overflow-y-auto` area that always renders once 2 characters are typed; `searching` dims old results. `AddCardDialog`, `DeckAddDialog` and `WantDialog` get `w-full` content so their width never changes. |
| Printing picker | `PrintingPicker` gains a toolbar: a finish `ToggleGroup` (`usePreference('printings.finish')`) and a sort `Select` (`usePreference('printings.sort')`), and the price under each printing (`prices[finish]` in the user's currency). It emits `update:finish` when the filter is Foil, Etched or Non-foil; the dialogs set their Finish field from it. |

## Files

```
components/decks/DeckList.vue          side image back, follows hover and focus
components/decks/DeckText.vue          preview opens on focus
components/CardPreview.vue             openOnFocus
components/decks/DeckSwaps.vue         mirrored four-part rows, trash icon
components/collection/CardSearch.vue   fixed results area, dimmed while loading
components/collection/PrintingPicker.vue  finish filter, sort, prices
components/collection/AddCardDialog.vue, EditItemDialog.vue, decks/DeckAddDialog.vue, wants/WantDialog.vue  finish follows the filter
```

## Tests

| File | Covers |
|---|---|
| `deck-add-polish.spec.ts` | AC-1 to AC-9 |
| `deck-views.spec.ts`, `deck-swaps.spec.ts`, `add-card.spec.ts` (updated) | List rows without popups, Remove as an icon, printing order |

## Order of work

1. Deck List side image and keyboard previews.
2. Swap rows.
3. Card search area; printing picker filter, sort and prices.
4. Tests, full suite, READMEs, spec status.
