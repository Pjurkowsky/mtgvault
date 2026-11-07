from django.contrib.auth import get_user_model
from django.db.models import Case, CharField, Count, F, Sum, Value, When
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.pricing import CURRENCIES, price_expression, prices_updated_at
from cards.views import price_context
from collection.filters import ItemFilterSerializer, apply_filters
from collection.views import PAGE_DEFAULT, PAGE_MAX, browse_params

from . import services
from .models import ANY, WantItem
from .serializers import (
    PublicWantPageSerializer,
    PublicWantSerializer,
    WantPageSerializer,
    WantSaveResultSerializer,
    WantSerializer,
    WantMissingRequestSerializer,
    WantSettingsSerializer,
    WantWriteSerializer,
    want_missing_result_serializer,
)

NOT_FOUND = 'Not found.'


def with_price_finish(entries):
    """Any finish is priced as non-foil (spec 010, AC-8)."""
    return entries.annotate(price_finish=Case(
        When(finish=ANY, then=Value('nonfoil')), default=F('finish'), output_field=CharField(),
    ))


def want_totals(entries, ctx) -> dict:
    """{card_count, value, values} for the want list tile (AC-7)."""
    sums = with_price_finish(entries).aggregate(
        card_count=Sum('quantity'),
        **{f'value_{c}': Sum(F('quantity') * price_expression(c, ctx['rates'], finish_field='price_finish'))
           for c in CURRENCIES},
    )
    values = {c: sums[f'value_{c}'] for c in CURRENCIES}
    return {'card_count': sums['card_count'] or 0, 'value': values[ctx['currency']], 'values': values}


def want_page(request, entries, serializer_class, ctx, *, own=True):
    params = ItemFilterSerializer(data=request.query_params)
    params.is_valid(raise_exception=True)
    filters = dict(params.validated_data)
    deck = filters.pop('deck', None)
    if deck and own:
        entries = entries.filter(deck_id=deck)
    rows = apply_filters(with_price_finish(entries.select_related('printing__set', 'deck')), filters,
                         ctx['currency'], ctx['rates'], finish_field='price_finish', collection=False)
    totals = want_totals(rows, ctx)
    try:
        offset = max(int(request.query_params.get('offset', 0)), 0)
        limit = min(max(int(request.query_params.get('limit', PAGE_DEFAULT)), 1), PAGE_MAX)
    except ValueError:
        raise ValidationError({'offset': ['Use whole numbers for offset and limit.']})
    return Response({
        'currency': ctx['currency'],
        'prices_updated_at': prices_updated_at(),
        'count': rows.aggregate(n=Count('id'))['n'],
        'total_quantity': totals['card_count'],
        'total_value': totals['value'],
        'total_values': totals['values'],
        'results': serializer_class(rows[offset:offset + limit], many=True, context=ctx).data,
    })


def serialize(entry, ctx):
    from collection.filters import with_unit_price
    row = with_unit_price(with_price_finish(WantItem.objects.filter(pk=entry.pk)), ctx['currency'], ctx['rates'],
                          'price_finish').select_related('printing__set', 'deck').get()
    return WantSerializer(row, context=ctx).data


def wanted(user, oracle_id) -> int:
    return WantItem.objects.filter(user=user, oracle_id=oracle_id).aggregate(n=Sum('quantity'))['n'] or 0


def saved(request, entry, merged, created=False):
    ctx = price_context(request)
    return Response(
        {'want': serialize(entry, ctx), 'merged': merged, 'wanted': wanted(request.user, entry.oracle_id)},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


class WantListView(APIView):
    @extend_schema(operation_id='wants_list', parameters=browse_params(), responses=WantPageSerializer)
    def get(self, request):
        return want_page(request, WantItem.objects.filter(user=request.user), WantSerializer, price_context(request))

    @extend_schema(request=WantWriteSerializer, responses={201: WantSaveResultSerializer})
    def post(self, request):
        data = WantWriteSerializer(data=request.data, context={'request': request})
        data.is_valid(raise_exception=True)
        entry, merged = services.add_want(request.user, **data.validated_data)
        return saved(request, entry, merged, created=True)


class WantDetailView(APIView):
    def get_entry(self, request, pk):
        return get_object_or_404(WantItem, user=request.user, pk=pk)

    @extend_schema(responses=WantSerializer)
    def get(self, request, pk):
        return Response(serialize(self.get_entry(request, pk), price_context(request)))

    @extend_schema(request=WantWriteSerializer(partial=True), responses=WantSaveResultSerializer)
    def patch(self, request, pk):
        entry = self.get_entry(request, pk)
        data = WantWriteSerializer(data=request.data, partial=True, context={'request': request})
        data.is_valid(raise_exception=True)
        entry, merged = services.edit_want(entry, **data.validated_data)
        return saved(request, entry, merged)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        self.get_entry(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WantSettingsView(APIView):
    """The want list's Public switch (AC-18)."""

    @extend_schema(responses=WantSettingsSerializer)
    def get(self, request):
        return Response({'is_public': request.user.wants_public})

    @extend_schema(request=WantSettingsSerializer, responses=WantSettingsSerializer)
    def patch(self, request):
        data = WantSettingsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        request.user.wants_public = data.validated_data['is_public']
        request.user.save(update_fields=['wants_public'])
        return Response({'is_public': request.user.wants_public})


def public_wants_owner(username):
    """Private and missing want lists look the same from outside (AC-18)."""
    user = get_user_model().objects.filter(username__iexact=username, wants_public=True).first()
    if user is None:
        raise Http404(NOT_FOUND)
    return user


class PublicWantListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id='users_wants_list', parameters=browse_params(), responses=PublicWantPageSerializer)
    def get(self, request, username):
        user = public_wants_owner(username)
        return want_page(request, WantItem.objects.filter(user=user), PublicWantSerializer, price_context(request),
                         own=False)


class WantMissingView(APIView):
    """A deck's missing cards onto the want list, for the deck (AC-15, AC-16)."""

    @extend_schema(request=WantMissingRequestSerializer, responses=want_missing_result_serializer())
    def post(self, request, pk):
        from decks.models import Deck
        from decks.serializers import DeckDetailSerializer
        from decks.views import build

        deck = get_object_or_404(Deck, user=request.user, pk=pk)
        data = WantMissingRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        card = None
        if 'card' in data.validated_data:
            card = get_object_or_404(deck.cards.select_related('printing'), pk=data.validated_data['card'])
        added = services.want_missing(deck, card)
        deck = Deck.objects.select_related('location', 'user').get(pk=deck.pk)
        return Response({'added': added, 'deck': DeckDetailSerializer(build(deck, price_context(request))).data})
