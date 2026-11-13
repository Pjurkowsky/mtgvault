from django.db.models import Case, CharField, Count, F, IntegerField, OuterRef, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.pricing import CURRENCIES, price_expression, prices_updated_at
from cards.views import price_context
from collection.filters import apply_filters
from collection.models import CollectionItem
from collection.views import PAGE_DEFAULT, PAGE_MAX
from decks.models import Deck
from decks.views import BRANCH, VERSION, own_deck, shown_cards

from .deck import deck_products
from .models import Product, ProductCard
from .serializers import (
    DeckProductsQuerySerializer,
    DeckProductsSerializer,
    ProductDetailSerializer,
    ProductFilterSerializer,
    ProductItemPageSerializer,
)
from .sync import synced


def products_response(request, deck):
    query = DeckProductsQuerySerializer(data=request.query_params)
    query.is_valid(raise_exception=True)
    q = query.validated_data
    found = deck_products(deck, shown_cards(request, deck), q['cards'], q['printing'], int(q['since']))
    return Response(DeckProductsSerializer({**found, 'synced': synced()}, context=price_context(request)).data)


class DeckProductsView(APIView):
    """Products holding the deck's cards (spec 030, AC-1 to AC-7)."""

    @extend_schema(parameters=[DeckProductsQuerySerializer, BRANCH, VERSION], responses=DeckProductsSerializer)
    def get(self, request, pk):
        return products_response(request, own_deck(request, pk))


class PublicDeckProductsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[DeckProductsQuerySerializer, BRANCH, VERSION], responses=DeckProductsSerializer)
    def get(self, request, username, pk):
        return products_response(request, get_object_or_404(Deck, pk=pk, user__username__iexact=username, is_public=True))


def product_rows(request, product, params):
    """The product's printings as card browser rows, filtered like a collection (AC-9 to AC-11)."""
    rows = ProductCard.objects.filter(product=product).select_related('printing__set').annotate(
        # Priced and filtered as non-foil when the printing has it, as To buy does.
        finish=Case(When(printing__finishes__contains=['nonfoil'], then=Value('nonfoil')),
                    When(printing__finishes__contains=['foil'], then=Value('foil')),
                    default=Value('etched'), output_field=CharField()),
        quantity=Case(When(copies__gt=0, then=F('copies')), default=Value(1)),
        added_at=F('id'),
    )
    user = request.user if request.user.is_authenticated else None
    if user:
        owned = (CollectionItem.objects.filter(user=user, in_cart=False, printing__oracle_id=OuterRef('printing__oracle_id'))
                 .values('printing__oracle_id').annotate(n=Sum('quantity')).values('n'))
        rows = rows.annotate(owned=Coalesce(Subquery(owned), 0))
        if params.get('owned') == 'owned':
            rows = rows.filter(owned__gt=0)
        elif params.get('owned') == 'not_owned':
            rows = rows.filter(owned=0)
    else:
        rows = rows.annotate(owned=Value(None, output_field=IntegerField()))
    sort = params.get('sort')
    filtered = apply_filters(rows, {**params, 'sort': 'name' if sort == 'chance' else sort}, *price_args(request), collection=False)
    if sort == 'chance':
        key = F('chance').asc(nulls_last=True) if params.get('dir') == 'asc' else F('chance').desc(nulls_last=True)
        filtered = filtered.order_by(key, 'printing__name', 'id')
    return filtered


def price_args(request):
    ctx = price_context(request)
    return ctx['currency'], ctx['rates']


class ProductDetailView(APIView):
    """A product's name, set and size (spec 030, AC-8)."""

    permission_classes = [AllowAny]

    @extend_schema(responses=ProductDetailSerializer)
    def get(self, request, code):
        product = get_object_or_404(Product.objects.annotate(count=Count('cards')), code=code)
        return Response(ProductDetailSerializer(product).data)


class ProductItemsView(APIView):
    """Every card a product can hold (spec 030, AC-9 to AC-11)."""

    permission_classes = [AllowAny]

    @extend_schema(parameters=[ProductFilterSerializer], responses=ProductItemPageSerializer)
    def get(self, request, code):
        product = get_object_or_404(Product, code=code)
        params = ProductFilterSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        ctx = price_context(request)
        rows = product_rows(request, product, dict(params.validated_data))
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
            limit = min(max(int(request.query_params.get('limit', PAGE_DEFAULT)), 1), PAGE_MAX)
        except ValueError:
            raise ValidationError({'offset': ['Use whole numbers for offset and limit.']})
        sums = rows.aggregate(n=Count('id'), q=Sum('quantity'),
                              **{f'v_{c}': Sum(F('quantity') * price_expression(c, ctx['rates'])) for c in CURRENCIES})
        values = {c: sums[f'v_{c}'] for c in CURRENCIES}
        return Response(ProductItemPageSerializer({
            'currency': ctx['currency'], 'prices_updated_at': prices_updated_at(), 'count': sums['n'],
            'total_quantity': sums['q'] or 0, 'total_value': values[ctx['currency']], 'total_values': values,
            'results': rows[offset:offset + limit],
        }, context=ctx).data)
