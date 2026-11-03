from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.models import Printing
from cards.pricing import price
from cards.views import price_context
from collection.models import CollectionItem
from collection.serializers import EMPTY_TOTALS
from collection.services import Copies, save_item
from collection.views import location_totals, own_location, with_unit_price

from . import bundles
from .models import ScannerSettings
from .resolve import default_finish, matched_printing, rank_printings
from .serializers import (
    BundleInfoSerializer,
    LockedIllustrationsSerializer,
    ScannerSettingsSerializer,
    ScanRequestSerializer,
    ScanResultSerializer,
    UndoResultSerializer,
)

CONTENT_TYPES = {'.json': 'application/json', '.onnx': 'application/octet-stream'}


def cart_totals(user, ctx):
    rows = CollectionItem.objects.filter(user=user, in_cart=True)
    return location_totals(rows, ctx['currency'], ctx['rates']).get(None, EMPTY_TOTALS)


def row_totals(row, ctx):
    """Totals of the place a row is in: the cart, a location or Unfiled."""
    if row.in_cart:
        return cart_totals(row.user, ctx)
    rows = CollectionItem.objects.filter(user=row.user, in_cart=False, location_id=row.location_id)
    return location_totals(rows, ctx['currency'], ctx['rates']).get(row.location_id, EMPTY_TOTALS)


def deck_totals(deck, ctx):
    from decks.views import build  # imported here: decks depends on collection, not on the scanner
    data = build(deck, ctx, detail=False)
    return {'card_count': data['counts']['size'], 'value': data['value'], 'values': data['values']}


def sound_for(value, preferences):
    if value is not None and value >= preferences.ding_high:
        return 'big_ding'
    if value is not None and value >= preferences.ding_low:
        return 'ding'
    return 'click'


class BundleInfoView(APIView):
    @extend_schema(responses={200: BundleInfoSerializer, 503: OpenApiResponse(description='No bundle installed')})
    def get(self, request):
        version = bundles.current_version()
        if version is None:
            return Response({'detail': 'The card recognition model is not installed yet.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        meta = bundles.manifest(version)
        return Response({
            'version': version,
            'created': meta.get('created', ''),
            'gallery': meta.get('gallery', {}),
            'constants': meta['constants'],
            'files': {name: f'/api/scanner/bundles/{version}/{name}' for name in bundles.BROWSER_FILES},
            'sizes': {name: meta['files'][name]['bytes'] for name in bundles.BROWSER_FILES},
        }, headers={'Cache-Control': 'private, no-cache'})


class BundleFileView(APIView):
    """Model files are public (they are on GitHub too) and never change per version."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={(200, 'application/octet-stream'): bytes})
    def get(self, request, version, name):
        path = bundles.file_path(version, name)
        if path is None:
            raise Http404('No such bundle file.')
        response = FileResponse(path.open('rb'), content_type=CONTENT_TYPES[path.suffix])
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response


class ScannerSettingsView(APIView):
    @extend_schema(responses=ScannerSettingsSerializer)
    def get(self, request):
        return Response(ScannerSettingsSerializer(ScannerSettings.for_user(request.user)).data)

    @extend_schema(request=ScannerSettingsSerializer(partial=True), responses=ScannerSettingsSerializer)
    def patch(self, request):
        serializer = ScannerSettingsSerializer(ScannerSettings.for_user(request.user), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LockedIllustrationsView(APIView):
    """Artwork printed in the locked sets: only these may be logged (AC-8)."""

    @extend_schema(responses=LockedIllustrationsSerializer)
    def get(self, request):
        sets = ScannerSettings.for_user(request.user).locked_sets
        ids = (
            Printing.objects.filter(set_id__in=sets, illustration_id__isnull=False)
            .values_list('illustration_id', flat=True).distinct()
        ) if sets else []
        return Response({'sets': sets, 'illustration_ids': list(ids)})


class ScanView(APIView):
    """Log a recognized card (spec 003 AC-5, AC-9, AC-10, AC-17): into the cart, or the
    chosen location or decklist (spec 005, AC-16, AC-17)."""

    @extend_schema(request=ScanRequestSerializer, responses={201: ScanResultSerializer})
    def post(self, request):
        data = ScanRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        illustration = d.get('illustration_id')
        preferences = ScannerSettings.for_user(request.user)
        printing = rank_printings(
            matched_printing(d['gallery_id'], illustration), illustration, request.user, preferences.locked_sets,
        )[0]
        ctx = price_context(request)
        target = d.get('target') or {'kind': 'cart'}

        if target['kind'] == 'deck':
            from decks.services import add_card
            from decks.views import own_deck, preferred_finish
            deck = own_deck(request, target['deck'])
            existed = deck.cards.filter(oracle_id=printing.oracle_id, zone='main').exists()
            card = add_card(deck, printing, 1, 'main')
            card_price = price(card.printing, preferred_finish(card.printing), ctx['currency'], ctx['rates'])
            return Response(ScanResultSerializer({
                'item': None, 'merged': existed, 'totals': deck_totals(deck, ctx),
                'deck_card': {'id': card.id, 'deck': deck.id, 'quantity': card.quantity, 'printing': card.printing,
                              'price': card_price},
                'sound': sound_for(card_price, preferences),
            }, context=ctx).data, status=status.HTTP_201_CREATED)

        in_cart = target['kind'] == 'cart'
        location = None if in_cart else own_location(request.user, target.get('location'))
        row, merged = save_item(
            request.user, printing=printing, finish=default_finish(printing), condition='NM',
            language='en', location=location, copies=Copies(1), rates=ctx['rates'], in_cart=in_cart,
        )
        item = with_unit_price(CollectionItem.objects.filter(pk=row.pk), ctx['currency'], ctx['rates']) \
            .select_related('printing__set', 'location').get()
        return Response(ScanResultSerializer({
            'item': item, 'deck_card': None, 'merged': merged, 'totals': row_totals(item, ctx),
            'sound': sound_for(item.unit_price, preferences),
        }, context=ctx).data, status=status.HTTP_201_CREATED)


class UndoScanView(APIView):
    """Remove one copy from the row a scan logged into: cart or location (spec 003 AC-11, spec 005 AC-17)."""

    @extend_schema(request=None, responses=UndoResultSerializer)
    def post(self, request, pk):
        with transaction.atomic():
            row = get_object_or_404(CollectionItem.objects.select_for_update(), pk=pk, user=request.user)
            if row.quantity > 1:
                row.quantity -= 1
                row.save(update_fields=['quantity'])
                remaining = row.quantity
            else:
                row.delete()
                remaining = 0
        return Response({'remaining': remaining, 'totals': row_totals(row, price_context(request))})
