"""Recognized artwork -> the printing to log (spec 003, AC-9, AC-10).

Recognition identifies artwork, not printings: reprints share art. Ranking
follows manavault's printing-choice.ts: a locked set, then the scanned art,
then a printing the user owns, then English, then non-promo, then newest.
"""

import re

from rest_framework.exceptions import NotFound

from cards.models import Printing
from collection.models import CollectionItem

# Gallery ids name separate faces `<uuid>-<n>`; both faces are one card.
GALLERY_ID = re.compile(r'^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-\d+)?$', re.I)


def matched_printing(gallery_id: str, illustration_id: str | None) -> Printing:
    match = GALLERY_ID.match(gallery_id or '')
    printing = Printing.objects.filter(pk=match.group(1)).first() if match else None
    if printing is None and illustration_id:
        printing = Printing.objects.filter(illustration_id=illustration_id).order_by('-released_at').first()
    if printing is None:
        raise NotFound('Card not in catalog.')
    return printing


def rank_printings(printing: Printing, illustration_id: str | None, user, locked_sets: list[str]) -> list[Printing]:
    art = str(illustration_id or printing.illustration_id or '')
    locked = {code.lower() for code in locked_sets}
    options = list(Printing.objects.filter(oracle_id=printing.oracle_id).select_related('set'))
    owned = set(
        CollectionItem.objects.filter(user=user, in_cart=False, printing__oracle_id=printing.oracle_id)
        .values_list('printing_id', flat=True)
    )

    def key(p: Printing):
        return (
            not (locked and p.set_id in locked),
            not (art and str(p.illustration_id) == art),
            p.pk not in owned,
            p.lang != 'en',
            p.promo,
            -p.released_at.toordinal(),
        )

    return sorted(options, key=key)


def default_finish(printing: Printing) -> str:
    for finish in ('nonfoil', 'foil', 'etched'):
        if finish in printing.finishes:
            return finish
    return 'nonfoil'
