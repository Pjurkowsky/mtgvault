from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.pricing import CURRENCIES, latest_rates, price_expression, prices_updated_at
from cards.views import price_context

from . import textlist
from .filters import ItemFilterSerializer, apply_filters, with_unit_price
from .models import CollectionItem, Location
from .serializers import (
    EMPTY_TOTALS,
    BulkRequestSerializer,
    BulkResultSerializer,
    DirectoryUserSerializer,
    ExportRequestSerializer,
    ExportResultSerializer,
    ImportPreviewSerializer,
    ImportRequestSerializer,
    ImportResultSerializer,
    ItemPageSerializer,
    ItemSaveResultSerializer,
    ItemSerializer,
    ItemEditSerializer,
    ItemWriteSerializer,
    LocationDeleteSerializer,
    LocationListSerializer,
    LocationSerializer,
    PublicExportRequestSerializer,
    PublicItemPageSerializer,
    PublicItemSerializer,
    PublicLocationListSerializer,
    PublicLocationSerializer,
)
from .services import Copies, delete_pocket_copy, edit_copies, edit_item, save_item


def want_totals(user, ctx):
    """The want list tile's totals (spec 010, AC-7). Imported here: wants builds on collection."""
    from wants.models import WantItem
    from wants.views import want_totals as totals
    return totals(WantItem.objects.filter(user=user), ctx)


def fulfil(user, printing, finish, quantity, location):
    from wants.services import fulfil as lower  # new copies lower the want list (spec 010, AC-13)
    lower(user, printing, finish, quantity, location)

PAGE_DEFAULT, PAGE_MAX = 60, 200
NOT_FOUND = 'Not found.'


# ---------- helpers ----------

def value_sums() -> dict:
    """Aggregates for the total value in every currency (rows need value_<CUR>)."""
    return {f'value_{c}': Sum(F('quantity') * F(f'price_{c}')) for c in CURRENCIES}


def with_all_prices(items, rates):
    return items.annotate(**{f'price_{c}': price_expression(c, rates) for c in CURRENCIES})


def _totals_from(row: dict, currency: str) -> dict:
    values = {c: row[f'value_{c}'] for c in CURRENCIES}
    return {'card_count': row['card_count'] or 0, 'value': values[currency], 'values': values}


def location_totals(items, currency, rates) -> dict:
    """{location_id or None: {card_count, value, values}} for the given rows."""
    grouped = (
        with_all_prices(items, rates)
        .values('location_id')
        .annotate(card_count=Sum('quantity'), **value_sums())
    )
    return {g['location_id']: _totals_from(g, currency) for g in grouped}


def item_page(request, items, serializer_class, ctx):
    """Filter, count and page rows for the card browser."""
    params = ItemFilterSerializer(data=request.query_params)
    params.is_valid(raise_exception=True)
    rows = apply_filters(items.select_related('printing__set', 'location'), params.validated_data,
                         ctx['currency'], ctx['rates'])
    totals = with_all_prices(rows, ctx['rates']).aggregate(count=Count('id'), card_count=Sum('quantity'), **value_sums())
    money = _totals_from(totals, ctx['currency'])
    try:
        offset = max(int(request.query_params.get('offset', 0)), 0)
        limit = min(max(int(request.query_params.get('limit', PAGE_DEFAULT)), 1), PAGE_MAX)
    except ValueError:
        raise ValidationError({'offset': ['Use whole numbers for offset and limit.']})
    return Response({
        'currency': ctx['currency'],
        'prices_updated_at': prices_updated_at(),
        'count': totals['count'],
        'total_quantity': money['card_count'],
        'total_value': money['value'],
        'total_values': money['values'],
        'results': serializer_class(rows[offset:offset + limit], many=True, context=ctx).data,
    })


def sync_deck(location, deck_format=None):
    """Deck box locations are decks (spec 004 AC-4, spec 005 AC-18). Imported here: decks depends on collection."""
    from decks.services import sync_location
    sync_location(location, deck_format)


def own_location(user, location_id):
    if location_id is None:
        return None
    location = Location.objects.filter(user=user, pk=location_id).first()
    if location is None:
        raise ValidationError({'location': ['Unknown location.']})
    return location


def selected_items(user, selection: dict, ctx):
    items = CollectionItem.objects.filter(user=user)
    if 'ids' in selection:
        return items.filter(id__in=selection['ids']).order_by('id')
    rows = apply_filters(items, selection['filter'], ctx['currency'], ctx['rates'])
    return rows.exclude(id__in=selection.get('exclude_ids') or [])


def browse_params():
    return [
        OpenApiParameter(name, str, many=many) for name, many in [
            ('q', False), ('color', True), ('type', True), ('rarity', True), ('set', True),
            ('finish', True), ('condition', True), ('price_min', False), ('price_max', False),
            ('location', False), ('deck', False), ('sort', False), ('dir', False), ('offset', False), ('limit', False),
        ]
    ]


# ---------- locations ----------

class LocationListView(APIView):
    @extend_schema(operation_id='locations_list', responses=LocationListSerializer)
    def get(self, request):
        ctx = price_context(request)
        rows = CollectionItem.objects.filter(user=request.user)
        totals = location_totals(rows.filter(in_cart=False), ctx['currency'], ctx['rates'])
        cart = location_totals(rows.filter(in_cart=True), ctx['currency'], ctx['rates'])
        locations = Location.objects.filter(user=request.user).select_related('deck').order_by(F('name').asc())
        return Response({
            'currency': ctx['currency'],
            'unfiled': totals.get(None, EMPTY_TOTALS),
            'cart': cart.get(None, EMPTY_TOTALS),
            'wants': want_totals(request.user, ctx),
            'locations': LocationSerializer(locations, many=True, context={**ctx, 'totals': totals, 'request': request}).data,
        })

    @extend_schema(request=LocationSerializer, responses={201: LocationSerializer})
    def post(self, request):
        serializer = LocationSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        location = serializer.save(user=request.user)
        sync_deck(location, serializer.deck_format)
        return Response(LocationSerializer(location, context={'request': request}).data, status=status.HTTP_201_CREATED)


class LocationDetailView(APIView):
    def get_location(self, request, pk):
        return get_object_or_404(Location, user=request.user, pk=pk)

    @extend_schema(responses=LocationSerializer)
    def get(self, request, pk):
        location = self.get_location(request, pk)
        ctx = price_context(request)
        totals = location_totals(location.items.all(), ctx['currency'], ctx['rates'])
        return Response(LocationSerializer(location, context={'totals': totals, 'request': request}).data)

    @extend_schema(request=LocationSerializer, responses=LocationSerializer)
    def patch(self, request, pk):
        location = self.get_location(request, pk)
        serializer = LocationSerializer(location, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        location = serializer.save()
        sync_deck(location, serializer.deck_format)
        return self.get(request, pk)


class LocationDeleteView(APIView):
    """Delete a location, deciding what happens to its cards (AC-11)."""

    @extend_schema(request=LocationDeleteSerializer, responses={204: None})
    def post(self, request, pk):
        location = get_object_or_404(Location, user=request.user, pk=pk)
        data = LocationDeleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        action = data.validated_data.get('cards')
        rows = list(location.items.all())

        if rows and not action:
            raise ValidationError({'cards': ['Choose what happens to the cards in this location.']})
        with transaction.atomic():
            if action == 'delete':
                location.items.all().delete()
            elif rows:
                target = None
                if action == 'move':
                    target = own_location(request.user, data.validated_data.get('target'))
                    if target is None or target == location:
                        raise ValidationError({'target': ['Choose another location.']})
                rates = latest_rates()
                for row in rows:
                    edit_item(row, rates=rates, location=target)
            location.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- items ----------

class ItemListView(APIView):
    @extend_schema(operation_id='items_list', parameters=browse_params(), responses=ItemPageSerializer)
    def get(self, request):
        return item_page(request, CollectionItem.objects.filter(user=request.user), ItemSerializer,
                         price_context(request))

    @extend_schema(request=ItemWriteSerializer, responses={201: ItemSaveResultSerializer})
    def post(self, request):
        data = ItemWriteSerializer(data=request.data, context={'request': request})
        data.is_valid(raise_exception=True)
        d = data.validated_data
        ctx = price_context(request)
        with transaction.atomic():
            row, merged = save_item(
                request.user, printing=d['printing'], finish=d['finish'], condition=d['condition'],
                language=d['language'], location=d.get('location'), rates=ctx['rates'],
                copies=Copies(d['quantity'], d.get('purchase_price'), d.get('purchase_currency')),
            )
            fulfil(request.user, row.printing, row.finish, d['quantity'], d.get('location'))
            if d.get('slot'):  # Add card from an empty binder slot (spec 007, AC-14)
                from .binder import place_new
                place_new(d['location'], row, d['slot'])
        return Response(
            {'item': self._serialize(row, ctx), 'merged': merged},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _serialize(row, ctx):
        row = with_unit_price(CollectionItem.objects.filter(pk=row.pk), ctx['currency'], ctx['rates']) \
            .select_related('printing__set', 'location').get()
        return ItemSerializer(row, context=ctx).data


class ItemDetailView(APIView):
    def get_row(self, request, pk):
        return get_object_or_404(CollectionItem, user=request.user, pk=pk)

    @extend_schema(responses=ItemSerializer)
    def get(self, request, pk):
        return Response(ItemListView._serialize(self.get_row(request, pk), price_context(request)))

    @extend_schema(request=ItemEditSerializer(partial=True), responses=ItemSaveResultSerializer)
    def patch(self, request, pk):
        row = self.get_row(request, pk)
        data = ItemEditSerializer(data=request.data, partial=True, context={'request': request})
        data.is_valid(raise_exception=True)
        changes = dict(data.validated_data)
        copies, slot_id = changes.pop('copies', None), changes.pop('slot_id', None)
        ctx = price_context(request)
        with transaction.atomic():
            if copies is not None:
                result, merged = edit_copies(row, copies, slot_id, rates=ctx['rates'], **changes)
            else:
                result, merged = edit_item(row, rates=ctx['rates'], **changes)
        return Response({'item': ItemListView._serialize(result, ctx), 'merged': merged})

    @extend_schema(parameters=[OpenApiParameter('slot', int, description='Binder pocket: delete only its copy (spec 018, AC-3)')],
                   responses={204: None})
    def delete(self, request, pk):
        row = self.get_row(request, pk)
        slot = request.query_params.get('slot')
        if slot:
            with transaction.atomic():
                delete_pocket_copy(row, int(slot))
        else:
            row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BulkView(APIView):
    """Move, edit or delete many rows (AC-38 to AC-43). dry_run only counts."""

    @extend_schema(request=BulkRequestSerializer, responses=BulkResultSerializer)
    def post(self, request):
        data = BulkRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        ctx = price_context(request)
        rows = list(selected_items(request.user, d['selection'], ctx).select_related('printing'))
        changes = d.get('changes') or {}
        new_finish = changes.get('finish')
        skipped = [r for r in rows if d['action'] == 'edit' and new_finish and new_finish not in r.printing.finishes]
        targets = [r for r in rows if r not in skipped]
        result = {'rows': len(targets), 'cards': sum(r.quantity for r in targets), 'skipped': len(skipped)}
        if d['dry_run']:
            return Response(result)

        if d['action'] == 'move':
            if 'location' not in d:
                raise ValidationError({'location': ['Choose where to move the cards.']})
            # Moving always lands in the collection, also from the cart (spec 003, AC-21).
            changes = {'location': own_location(request.user, d['location'])}
        elif d['action'] == 'edit' and not changes:
            raise ValidationError({'changes': ['Choose what to change.']})

        with transaction.atomic():
            if d['action'] == 'delete':
                CollectionItem.objects.filter(id__in=[r.id for r in targets]).delete()
            else:
                for row in targets:
                    # A row can vanish mid-way when an earlier edit merged into it.
                    current = CollectionItem.objects.filter(pk=row.pk).first()
                    if current:
                        edit_item(current, rates=ctx['rates'], **changes)
        return Response(result)


class ExportView(APIView):
    @extend_schema(request=ExportRequestSerializer, responses=ExportResultSerializer)
    def post(self, request):
        data = ExportRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        rows = selected_items(request.user, data.validated_data['selection'], price_context(request)) \
            .select_related('printing')
        text, count = textlist.format_rows(rows, data.validated_data['printings'])
        return Response({'text': text, 'rows': count})


# ---------- import ----------

def _parse_import(request):
    data = ImportRequestSerializer(data=request.data, context={'request': request})
    data.is_valid(raise_exception=True)
    rows, errors = textlist.parse(data.validated_data['text'])
    return data.validated_data, rows, errors


class ImportPreviewView(APIView):
    @extend_schema(request=ImportRequestSerializer, responses=ImportPreviewSerializer)
    def post(self, request):
        _, rows, errors = _parse_import(request)
        return Response(ImportPreviewSerializer({
            'rows': rows, 'errors': errors, 'cards': sum(r.quantity for r in rows),
        }).data)


class ImportCommitView(APIView):
    """Parses the text again (never trusts the preview) and saves all rows at once (AC-49)."""

    @extend_schema(request=ImportRequestSerializer, responses=ImportResultSerializer)
    def post(self, request):
        d, rows, _ = _parse_import(request)
        rates = latest_rates()
        with transaction.atomic():
            for row in rows:
                save_item(
                    request.user, printing=row.printing, finish=row.finish, condition=d['condition'],
                    language=d['language'], location=d.get('location'), rates=rates,
                    copies=Copies(row.quantity, d.get('purchase_price'), d.get('purchase_currency')),
                )
                fulfil(request.user, row.printing, row.finish, row.quantity, d.get('location'))
        return Response({'rows': len(rows), 'cards': sum(r.quantity for r in rows)})


# ---------- public ----------

def public_location(username, pk):
    """Private and missing locations look the same from outside (AC-59)."""
    location = Location.objects.filter(user__username__iexact=username, pk=pk, is_public=True).first()
    if location is None:
        raise Http404(NOT_FOUND)
    return location


class DirectoryView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[OpenApiParameter('q', str)], responses=DirectoryUserSerializer(many=True))
    def get(self, request):
        users = (
            get_user_model().objects
            # A deck box counts once, as its deck (spec 005, AC-20).
            .annotate(public_locations=Count('locations', filter=Q(locations__is_public=True, locations__deck__isnull=True),
                                             distinct=True),
                      public_decks=Count('decks', filter=Q(decks__is_public=True), distinct=True))
            .filter(Q(public_locations__gt=0) | Q(public_decks__gt=0) | Q(wants_public=True))
            .order_by('username')
        )
        if q := request.query_params.get('q', '').strip():
            users = users.filter(username__icontains=q)
        return Response(DirectoryUserSerializer(users.values('username', 'public_locations', 'public_decks')[:100], many=True).data)


class PublicLocationListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id='users_locations_list', responses=PublicLocationListSerializer)
    def get(self, request, username):
        user = get_object_or_404(get_user_model(), username__iexact=username)
        ctx = price_context(request)
        # Deck boxes show through their decks (spec 005, AC-20).
        locations = Location.objects.filter(user=user, is_public=True, deck__isnull=True).order_by('name')
        totals = location_totals(CollectionItem.objects.filter(location__in=locations), ctx['currency'], ctx['rates'])
        return Response({
            'currency': ctx['currency'],
            'locations': PublicLocationSerializer(locations, many=True, context={'totals': totals}).data,
            # A public want list shows on the profile (spec 010, AC-18).
            'wants': want_totals(user, ctx) if user.wants_public else None,
        })


class PublicLocationDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=PublicLocationSerializer)
    def get(self, request, username, pk):
        location = public_location(username, pk)
        ctx = price_context(request)
        totals = location_totals(location.items.all(), ctx['currency'], ctx['rates'])
        return Response(PublicLocationSerializer(location, context={'totals': totals}).data)


class PublicItemListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=browse_params(), responses=PublicItemPageSerializer)
    def get(self, request, username, pk):
        location = public_location(username, pk)
        return item_page(request, location.items.all(), PublicItemSerializer, price_context(request))


class PublicExportView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=PublicExportRequestSerializer, responses=ExportResultSerializer)
    def post(self, request, username, pk):
        location = public_location(username, pk)
        data = PublicExportRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        ctx = price_context(request)
        rows = apply_filters(location.items.all(), data.validated_data.get('filter') or {}, ctx['currency'],
                             ctx['rates']).select_related('printing')
        text, count = textlist.format_rows(rows, data.validated_data['printings'])
        return Response({'text': text, 'rows': count})
