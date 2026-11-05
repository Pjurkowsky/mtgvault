"""Binder endpoints (spec 007): the layout, settings, moves and the public view."""

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.views import price_context

from . import binder
from .filters import with_unit_price
from .models import Location
from .serializers import (
    BinderMoveSerializer,
    BinderOrderSerializer,
    BinderSerializer,
    BinderSettingsSerializer,
    PublicBinderSerializer,
)
from .views import NOT_FOUND, public_location


def binder_payload(location: Location, ctx: dict, **extra) -> dict:
    slots = list(location.binder_slots.order_by('page', 'row', 'col', '-position'))
    matches = binder.section_matches(location, ctx)
    mismatched = binder.mismatched_slots(location, slots, matches)
    items = with_unit_price(binder.binder_items(location), ctx['currency'], ctx['rates']) \
        .select_related('printing__set', 'location').order_by('printing__name', 'id')
    pockets = {(s.page, s.row, s.col) for s in slots}
    per_page = location.binder_rows * location.binder_cols
    return {
        'rows': location.binder_rows,
        'cols': location.binder_cols,
        'spread': location.binder_spread,
        'pages': location.binder_pages,
        'page_count': binder.page_count(location),
        'used': len(pockets),
        'total': location.binder_pages * per_page if location.binder_pages else None,
        'sections': [{'name': s.name, 'first_page': s.first_page, 'last_page': s.last_page, 'filter': s.filter,
                      'matching': sorted(matches[s.pk]) if matches[s.pk] is not None else None}
                     for s in location.binder_sections.all()],
        'slots': [{'id': s.id, 'item_id': s.item_id, 'page': s.page, 'row': s.row, 'col': s.col,
                   'position': s.position, 'mismatch': s.id in mismatched} for s in slots],
        'items': items,
        'unplaced': [{'item': k, 'count': v} for k, v in binder.unplaced_counts(location).items()],
        'currency': ctx['currency'],
        **extra,
    }


def own_binder(request, pk) -> Location:
    location = get_object_or_404(Location, user=request.user, pk=pk)
    if not binder.is_binder(location):
        raise Http404(NOT_FOUND)
    return location


def respond(request, location, **extra):
    ctx = price_context(request)
    return Response(BinderSerializer(binder_payload(location, ctx, **extra), context=ctx).data)


class BinderView(APIView):
    @extend_schema(responses=BinderSerializer)
    def get(self, request, pk):
        return respond(request, own_binder(request, pk))

    @extend_schema(request=BinderSettingsSerializer, responses=BinderSerializer)
    def patch(self, request, pk):
        location = own_binder(request, pk)
        data = BinderSettingsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        moved = binder.update_settings(location, data.validated_data)
        location.refresh_from_db()
        return respond(request, location, unplaced_now=moved)


class BinderMoveView(APIView):
    @extend_schema(request=BinderMoveSerializer, responses=BinderSerializer)
    def post(self, request, pk):
        location = own_binder(request, pk)
        data = BinderMoveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        binder.move(location, slot_id=d.get('slot'), item_id=d.get('item'), to=d['to'], mode=d['mode'])
        return respond(request, location)


class BinderOrderView(APIView):
    @extend_schema(request=BinderOrderSerializer, responses=BinderSerializer)
    def post(self, request, pk):
        location = own_binder(request, pk)
        data = BinderOrderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        binder.order(location, {'page': d['page'], 'row': d['row'], 'col': d['col']}, d['slots'])
        return respond(request, location)


class PublicBinderView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=PublicBinderSerializer)
    def get(self, request, username, pk):
        location = public_location(username, pk)
        if not binder.is_binder(location):
            raise Http404(NOT_FOUND)
        ctx = price_context(request)
        return Response(PublicBinderSerializer(binder_payload(location, ctx), context=ctx).data)
