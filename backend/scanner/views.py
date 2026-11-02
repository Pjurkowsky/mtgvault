from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.models import Printing
from cards.views import price_context
from collection.models import CollectionItem
from collection.serializers import EMPTY_TOTALS
from collection.services import Copies, save_item
from collection.views import location_totals, with_unit_price

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
    """Log a recognized card into the cart (AC-5, AC-9, AC-10, AC-17)."""

    @extend_schema(request=ScanRequestSerializer, responses={201: ScanResultSerializer})
    def post(self, request):
        data = ScanRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        illustration = data.validated_data.get('illustration_id')
        preferences = ScannerSettings.for_user(request.user)
        printing = rank_printings(
            matched_printing(data.validated_data['gallery_id'], illustration),
            illustration, request.user, preferences.locked_sets,
        )[0]
        ctx = price_context(request)
        row, merged = save_item(
            request.user, printing=printing, finish=default_finish(printing), condition='NM',
            language='en', location=None, copies=Copies(1), rates=ctx['rates'], in_cart=True,
        )
        item = with_unit_price(CollectionItem.objects.filter(pk=row.pk), ctx['currency'], ctx['rates']) \
            .select_related('printing__set', 'location').get()
        price = item.unit_price
        sound = 'click'
        if price is not None and price >= preferences.ding_high:
            sound = 'big_ding'
        elif price is not None and price >= preferences.ding_low:
            sound = 'ding'
        return Response(ScanResultSerializer({
            'item': item, 'merged': merged, 'cart': cart_totals(request.user, ctx), 'sound': sound,
        }, context=ctx).data, status=status.HTTP_201_CREATED)


class UndoScanView(APIView):
    """Remove one copy from a cart row (AC-11)."""

    @extend_schema(request=None, responses=UndoResultSerializer)
    def post(self, request, pk):
        with transaction.atomic():
            row = get_object_or_404(CollectionItem.objects.select_for_update(), pk=pk, user=request.user, in_cart=True)
            if row.quantity > 1:
                row.quantity -= 1
                row.save(update_fields=['quantity'])
                remaining = row.quantity
            else:
                row.delete()
                remaining = 0
        return Response({'remaining': remaining, 'cart': cart_totals(request.user, price_context(request))})
