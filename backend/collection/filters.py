"""The card browser's search, filters and sort (AC-30 to AC-33).

One serializer and one function, used by every list, bulk action, export and
public page, so a filter means the same thing everywhere (principle P-2).
"""

from django.db.models import Case, F, IntegerField, Q, Value, When
from rest_framework import serializers

from cards.models import Finish, Rarity
from cards.pricing import price_expression
from cards.scryfall import CARD_TYPES

from .models import Condition

COLORS = ['W', 'U', 'B', 'R', 'G', 'C']  # C = colorless
SORTS = ['name', 'set', 'rarity', 'price', 'quantity', 'added', 'color', 'mana_value']
RARITY_ORDER = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus']


class ItemFilterSerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True)
    color = serializers.ListField(child=serializers.ChoiceField(COLORS), required=False)
    type = serializers.ListField(child=serializers.ChoiceField(sorted(CARD_TYPES)), required=False)
    rarity = serializers.ListField(child=serializers.ChoiceField(Rarity.choices), required=False)
    set = serializers.ListField(child=serializers.CharField(max_length=10), required=False)
    finish = serializers.ListField(child=serializers.ChoiceField(Finish.choices), required=False)
    condition = serializers.ListField(child=serializers.ChoiceField(Condition.choices), required=False)
    price_min = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0)
    price_max = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, min_value=0)
    location = serializers.CharField(required=False, help_text='Location id, "unfiled" or "cart"')
    deck = serializers.IntegerField(required=False, help_text="Only copies of this deck's cards")
    sort = serializers.ChoiceField(SORTS, default='name')
    dir = serializers.ChoiceField(['asc', 'desc'], default='asc')

    def validate_location(self, value):
        if value not in ('unfiled', 'cart') and not value.isdigit():
            raise serializers.ValidationError('Use a location id, "unfiled" or "cart".')
        return value


def with_unit_price(items, currency, rates):
    """Annotate `unit_price`: market price per copy in `currency`."""
    return items.annotate(unit_price=price_expression(currency, rates))


def _color_rank():
    """WUBRG order, then multicolor, then colorless."""
    return Case(
        When(printing__colors__len=0, then=Value(7)),
        When(printing__colors__len__gt=1, then=Value(6)),
        *[When(printing__colors__contains=[c], then=Value(i)) for i, c in enumerate('WUBRG', start=1)],
        default=Value(8),
        output_field=IntegerField(),
    )


def _rarity_rank():
    return Case(
        *[When(printing__rarity=r, then=Value(i)) for i, r in enumerate(RARITY_ORDER)],
        default=Value(99),
        output_field=IntegerField(),
    )


SORT_KEYS = {
    'name': lambda: [F('printing__name')],
    'set': lambda: [F('printing__set__name'), F('printing__collector_number')],
    'rarity': lambda: [_rarity_rank()],
    'price': lambda: [F('unit_price')],
    'quantity': lambda: [F('quantity')],
    'added': lambda: [F('added_at')],
    'color': lambda: [_color_rank()],
    'mana_value': lambda: [F('printing__cmc')],
}


def apply_filters(items, params: dict, currency: str, rates: dict):
    """Filter and sort `items` (already scoped to one user or public location).
    Expects validated ItemFilterSerializer data."""
    items = with_unit_price(items, currency, rates)

    if q := (params.get('q') or '').strip():
        items = items.filter(Q(printing__name__icontains=q) | Q(printing__front_name__icontains=q))
    if colors := params.get('color'):
        match = Q(printing__colors__overlap=[c for c in colors if c != 'C'])
        if 'C' in colors:
            match |= Q(printing__colors__len=0)
        items = items.filter(match)
    if types := params.get('type'):
        items = items.filter(printing__types__overlap=types)
    if rarities := params.get('rarity'):
        items = items.filter(printing__rarity__in=rarities)
    if sets := params.get('set'):
        items = items.filter(printing__set_id__in=[s.lower() for s in sets])
    if finishes := params.get('finish'):
        items = items.filter(finish__in=finishes)
    if conditions := params.get('condition'):
        items = items.filter(condition__in=conditions)
    if params.get('price_min') is not None:
        items = items.filter(unit_price__gte=params['price_min'])
    if params.get('price_max') is not None:
        items = items.filter(unit_price__lte=params['price_max'])
    if deck := params.get('deck'):
        from decks.models import DeckCard  # decks depends on collection
        items = items.filter(printing__oracle_id__in=DeckCard.objects.filter(deck_id=deck).values('oracle_id'))
    # The cart is only ever shown on its own; everything else is the collection (spec 003, AC-18).
    location = params.get('location')
    items = items.filter(in_cart=location == 'cart')
    if location == 'unfiled':
        items = items.filter(location__isnull=True)
    elif location and location != 'cart':
        items = items.filter(location_id=int(location))

    descending = params.get('dir') == 'desc'
    keys = SORT_KEYS[params.get('sort') or 'name']()
    ordering = [k.desc(nulls_last=True) if descending else k.asc(nulls_last=True) for k in keys]
    # Stable tiebreakers so paging never repeats or skips rows.
    return items.order_by(*ordering, 'printing__name', 'id')
