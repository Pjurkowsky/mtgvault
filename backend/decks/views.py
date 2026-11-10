from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Case, F, Value, When
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cards.pricing import CURRENCIES, price, prices_in_all, prices_updated_at
from cards.tokens import deck_tokens
from cards.views import price_context
from collection.filters import ItemFilterSerializer, apply_filters
from collection.serializers import ExportResultSerializer, PublicItemPageSerializer, PublicItemSerializer
from collection.services import Copies, save_item
from collection.views import browse_params, selected_items

from . import services, stats, textlist
from .legality import COUNTED, FORMATS, issues
from .models import Deck, DeckCard
from .optimize import cheapest_changes
from .ownership import deck_ownership
from .serializers import (
    AddFromCollectionSerializer,
    AddResultSerializer,
    CategorySuggestionsSerializer,
    CreateBoxSerializer,
    DeckCardEditSerializer,
    DeckCardWriteSerializer,
    DeckDeleteSerializer,
    DeckDetailSerializer,
    DeckExportParamsSerializer,
    DeckImportPreviewSerializer,
    DeckListSerializer,
    DeckTextSerializer,
    DeckWriteSerializer,
    MarkOwnedSerializer,
    MissingExportSerializer,
    OptimizeApplySerializer,
    OptimizePreviewSerializer,
    SwapProposalSerializer,
    ApplySwapSerializer,
    PairSerializer,
)

PAGE_DEFAULT, PAGE_MAX = 60, 200


def preferred_finish(printing) -> str:
    return 'nonfoil' if 'nonfoil' in printing.finishes else (printing.finishes or ['nonfoil'])[0]


def deck_cards(deck):
    return list(deck.cards.select_related('printing__set').prefetch_related('swaps_for').order_by('printing__name'))


def build(deck, ctx, detail=True, public=False) -> dict:
    """Summary (tiles) or full deck (page) as plain data."""
    cards = deck_cards(deck)
    own = deck_ownership(deck, cards)
    st = stats.deck_stats(cards, own, ctx['currency'], ctx['rates'])
    by_zone = {zone: sum(c.quantity for c in cards if c.zone == zone) for zone in DeckCard.Zone.values}
    counted_oracles = {}
    for c in cards:
        if c.zone in COUNTED:
            counted_oracles[c.oracle_id] = own[c.id]
    owned = sum(min(o['needed'], o['in_box'] + o['free']) for o in counted_oracles.values())
    missing = sum(o['needed'] - min(o['needed'], o['in_box'] + o['free']) for o in counted_oracles.values())
    image_card = next((c for c in cards if c.zone == 'commander'), None) or next((c for c in cards if c.zone == 'main'), None)
    data = {
        'id': deck.id, 'name': deck.name, 'format': deck.format, 'is_public': deck.is_public,
        'location': deck.location_id, 'location_name': deck.location.name if deck.location_id else None,
        'image': image_card.printing.image_normal.replace('/normal/', '/art_crop/') if image_card else '',
        'counts': {**by_zone, 'size': by_zone['commander'] + by_zone['main'], 'target': FORMATS[deck.format].size,
                   'owned': owned, 'missing': missing},
        'value': st['value']['total'], 'values': st['values']['total'],
    }
    if not detail:
        return data
    problems = issues(deck, cards)
    out_cards = []
    for c in cards:
        finish = preferred_finish(c.printing)
        ownership = dict(own[c.id])
        if public:  # AC-28: no location or other deck names for visitors
            ownership['free_copies'] = []
            ownership['box_copies'] = []
            ownership['other_decks'] = []
            ownership['wanted'] = 0
        out_cards.append({
            'id': c.id, 'zone': c.zone, 'quantity': c.quantity, 'printing': c.printing,
            'price': price(c.printing, finish, ctx['currency'], ctx['rates']),
            'prices': prices_in_all(c.printing, finish, ctx['rates']),
            'ownership': ownership,
            'swap_for': sorted(o.id for o in c.swaps_for.all()),
            'categories': c.categories,
        })
    return {**data, 'username': deck.user.username, 'currency': ctx['currency'], 'cards': out_cards,
            'legality': {'legal': not problems, 'issues': problems}, 'stats': st,
            'tokens': deck_tokens([c for c in cards if c.zone in COUNTED])}


def own_deck(request, pk) -> Deck:
    return get_object_or_404(Deck.objects.select_related('location', 'user'), pk=pk, user=request.user)


def detail_response(request, deck, code=status.HTTP_200_OK):
    deck = Deck.objects.select_related('location', 'user').get(pk=deck.pk)
    return Response(DeckDetailSerializer(build(deck, price_context(request))).data, status=code)


def import_text(deck, text):
    rows, errors = textlist.parse(text)
    with transaction.atomic():
        for zone, row in rows:
            card = services.add_card(deck, row.printing, row.quantity, services.fit_zone(deck, zone))
            if row.categories:
                card.categories = services.merge_categories(card.categories, row.categories)
                card.save(update_fields=['categories'])
    return rows, errors


class DeckListView(APIView):
    @extend_schema(operation_id='decks_list', responses=DeckListSerializer)
    def get(self, request):
        ctx = price_context(request)
        decks = Deck.objects.filter(user=request.user).select_related('location').order_by('name')
        return Response(DeckListSerializer({'currency': ctx['currency'],
                                            'decks': [build(d, ctx, detail=False) for d in decks]}).data)

    @extend_schema(request=DeckWriteSerializer, responses={201: DeckDetailSerializer})
    def post(self, request):
        data = DeckWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        with transaction.atomic():
            deck = Deck.objects.create(user=request.user, name=d['name'], format=d['format'], is_public=d['is_public'])
            if d.get('create_box'):
                services.create_box(deck, [])
            if d.get('text'):
                import_text(deck, d['text'])
        return detail_response(request, deck, status.HTTP_201_CREATED)


class DeckDetailView(APIView):
    @extend_schema(responses=DeckDetailSerializer)
    def get(self, request, pk):
        return detail_response(request, own_deck(request, pk))

    @extend_schema(request=DeckWriteSerializer(partial=True), responses=DeckDetailSerializer)
    def patch(self, request, pk):
        deck = own_deck(request, pk)
        data = DeckWriteSerializer(deck, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        new_format = data.validated_data.pop('format', None)
        with transaction.atomic():
            data.save()
            if new_format and new_format != deck.format:
                services.set_format(deck, new_format)  # cards in zones it lacks move over
            services.share_visibility(deck)
        return detail_response(request, deck)


class DeckDeleteView(APIView):
    @extend_schema(request=DeckDeleteSerializer, responses={204: None})
    def post(self, request, pk):
        data = DeckDeleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.delete_deck(own_deck(request, pk), data.validated_data.get('box'))
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeckCardsView(APIView):
    @extend_schema(request=DeckCardWriteSerializer, responses={201: DeckDetailSerializer})
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = DeckCardWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.add_card(deck, **data.validated_data)
        return detail_response(request, deck, status.HTTP_201_CREATED)


class DeckCardDetailView(APIView):
    def get_card(self, request, pk, card_id):
        deck = own_deck(request, pk)
        return deck, get_object_or_404(DeckCard, pk=card_id, deck=deck)

    @extend_schema(request=DeckCardEditSerializer, responses=DeckDetailSerializer)
    def patch(self, request, pk, card_id):
        deck, card = self.get_card(request, pk, card_id)
        data = DeckCardEditSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        with transaction.atomic():
            if 'printing' in d:
                if d['printing'].oracle_id != card.oracle_id:
                    raise ValidationError({'printing': ['Pick a printing of the same card.']})
                card.printing = d['printing']
            if 'quantity' in d:
                card.quantity = d['quantity']
            if 'categories' in d:
                card.categories = services.merge_categories(d['categories'])
            card.save()
            if 'zone' in d:
                services.move_zone(card, d['zone'])  # merges with that zone
        return detail_response(request, deck)

    @extend_schema(responses=DeckDetailSerializer)
    def delete(self, request, pk, card_id):
        deck, card = self.get_card(request, pk, card_id)
        card.delete()
        return detail_response(request, deck)


class CategorySuggestionsView(APIView):
    """Spec 006, AC-13: category names to suggest."""

    @extend_schema(responses=CategorySuggestionsSerializer)
    def get(self, request):
        return Response({'categories': services.category_suggestions(request.user)})


class MarkOwnedView(APIView):
    """AC-15: move a free copy into the deck box, or record a new copy."""

    @extend_schema(request=MarkOwnedSerializer, responses=DeckDetailSerializer)
    def post(self, request, pk, card_id):
        deck = own_deck(request, pk)
        card = get_object_or_404(DeckCard, pk=card_id, deck=deck)
        data = MarkOwnedSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        with transaction.atomic():
            if 'item_id' in d:
                if not deck.location_id:
                    raise ValidationError({'item_id': ['This deck has no deck box to move copies into.']})
                row = services.free_row(deck, d['item_id'])
                if row.printing.oracle_id != card.oracle_id:
                    raise ValidationError({'item_id': ['That copy is a different card.']})
                services.move_copies(row, min(d['quantity'], row.quantity), deck.location)
            else:
                new = d['new']
                printing = new.get('printing') or card.printing
                if printing.oracle_id != card.oracle_id:
                    raise ValidationError({'new': ['Pick a printing of the same card.']})
                row, _ = save_item(
                    request.user, printing=printing, finish=new.get('finish') or preferred_finish(printing),
                    condition=new['condition'], language=new['language'], location=deck.location,
                    copies=Copies(d['quantity']),
                )
                from wants.services import fulfil  # spec 010, AC-13
                fulfil(request.user, printing, row.finish, d['quantity'], deck.location)
        return detail_response(request, deck)


class ProposeSwapView(APIView):
    """Spec 005, AC-9: a Maybeboard candidate to replace this card."""

    @extend_schema(request=SwapProposalSerializer, responses={201: DeckDetailSerializer})
    def post(self, request, pk, card_id):
        deck = own_deck(request, pk)
        card = get_object_or_404(DeckCard, pk=card_id, deck=deck)
        data = SwapProposalSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.propose_swap(card, data.validated_data['printing'])
        return detail_response(request, deck, status.HTTP_201_CREATED)


class ApplySwapView(APIView):
    """Spec 005 AC-11, spec 021 AC-17: one copy goes in, that copy of the old card becomes its candidate."""

    @extend_schema(request=ApplySwapSerializer, responses=DeckDetailSerializer)
    def post(self, request, pk, card_id):
        deck = own_deck(request, pk)
        data = ApplySwapSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        candidate = get_object_or_404(DeckCard.objects.select_related('printing'), pk=card_id, deck=deck)
        services.apply_swap(candidate, get_object_or_404(DeckCard, pk=data.validated_data['out'], deck=deck))
        return detail_response(request, deck)


class PairsView(APIView):
    """Spec 021, AC-14: propose a swap between a deck card and a Maybeboard or new card."""

    @extend_schema(request=PairSerializer, responses={201: DeckDetailSerializer})
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = PairSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        out = get_object_or_404(DeckCard, pk=d['out'], deck=deck)
        with transaction.atomic():
            if 'card' in d:
                candidate = get_object_or_404(DeckCard, pk=d['card'], deck=deck)
            else:
                if d['printing'].oracle_id == out.oracle_id:
                    raise ValidationError({'printing': ['Pick a different card.']})
                candidate = services.maybe_card(deck, d['printing'])
            if not services.add_pair(out, candidate):
                raise ValidationError({'detail': 'Already proposed.'})
        return detail_response(request, deck, status.HTTP_201_CREATED)


class UnpairView(APIView):
    """Spec 021, AC-16: drop a pair; the cards stay."""

    @extend_schema(request=None, responses=DeckDetailSerializer)
    def delete(self, request, pk, card_id, out_id):
        deck = own_deck(request, pk)
        candidate = get_object_or_404(DeckCard, pk=card_id, deck=deck)
        services.unpair(candidate, get_object_or_404(DeckCard, pk=out_id, deck=deck))
        return detail_response(request, deck)


class CreateBoxView(APIView):
    @extend_schema(request=CreateBoxSerializer, responses={201: DeckDetailSerializer})
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = CreateBoxSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.create_box(deck, data.validated_data['moves'])
        return detail_response(request, deck, status.HTTP_201_CREATED)


class AddFromCollectionView(APIView):
    """AC-10: one copy of each selected card, into a deck's zone."""

    @extend_schema(request=AddFromCollectionSerializer, responses=AddResultSerializer)
    def post(self, request):
        data = AddFromCollectionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        deck = own_deck(request, d['deck'])
        rows = selected_items(request.user, d['selection'], price_context(request)).select_related('printing')
        added = {}
        for row in rows:
            added.setdefault(row.printing.oracle_id, row.printing)
        with transaction.atomic():
            for printing in added.values():
                services.add_card(deck, printing, 1, d['zone'])
        return Response({'cards': len(added)})


class DeckImportPreviewView(APIView):
    @extend_schema(request=DeckTextSerializer, responses=DeckImportPreviewSerializer)
    def post(self, request):
        data = DeckTextSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        rows, errors = textlist.parse(data.validated_data['text'])
        return Response(DeckImportPreviewSerializer({
            'rows': [{'line': r.line, 'zone': zone, 'quantity': r.quantity, 'printing': r.printing, 'categories': r.categories}
                     for zone, r in rows],
            'errors': errors, 'cards': sum(r.quantity for _, r in rows),
        }).data)


class DeckImportView(APIView):
    @extend_schema(request=DeckTextSerializer, responses=DeckDetailSerializer)
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = DeckTextSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        import_text(deck, data.validated_data['text'])
        return detail_response(request, deck)


class DeckExportView(APIView):
    @extend_schema(parameters=[DeckExportParamsSerializer], responses=ExportResultSerializer)
    def get(self, request, pk):
        cards = deck_cards(own_deck(request, pk))
        params = DeckExportParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        d = params.validated_data
        text = textlist.format_deck(cards, d['printings'], d['categories'],
                                    deck_tokens([c for c in cards if c.zone in COUNTED]) if d['tokens'] else None)
        return Response({'text': text, 'rows': len(cards)})


def missing_rows(deck, params, ctx, other_decks=False):
    """Missing copies of counted cards, filtered and sorted like the card browser (AC-17).
    With `other_decks`, also the copies found only in other decks' boxes (spec 014, AC-5)."""
    all_cards = deck_cards(deck)
    own = deck_ownership(deck, all_cards)
    cards = DeckCard.objects.filter(deck=deck, zone__in=COUNTED).annotate(
        finish=Case(
            When(printing__finishes__contains=['nonfoil'], then=Value('nonfoil')),
            When(printing__finishes__contains=['foil'], then=Value('foil')),
            default=Value('etched'),
        ),
        condition=Value('NM'), in_cart=Value(False), added_at=F('created_at'),
    ).select_related('printing__set')
    rows, seen = [], set()
    for card in apply_filters(cards, params, ctx['currency'], ctx['rates']):
        o = own[card.id]
        missing = max(0, o['needed'] - o['in_box'] - o['free']) if other_decks else o['missing']
        if missing <= 0 or card.oracle_id in seen:
            continue
        seen.add(card.oracle_id)
        rows.append(SimpleNamespace(id=card.id, printing=card.printing, quantity=missing, finish=card.finish,
                                    condition='NM', language='en', unit_price=card.unit_price))
    return rows


class MissingView(APIView):
    @extend_schema(parameters=browse_params(), responses=PublicItemPageSerializer)
    def get(self, request, pk):
        deck = own_deck(request, pk)
        params = ItemFilterSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        ctx = price_context(request)
        rows = missing_rows(deck, params.validated_data, ctx)
        offset = max(int(request.query_params.get('offset', 0) or 0), 0)
        limit = min(max(int(request.query_params.get('limit', PAGE_DEFAULT) or PAGE_DEFAULT), 1), PAGE_MAX)
        totals = {cur: 0 for cur in CURRENCIES}
        for r in rows:
            for cur, value in prices_in_all(r.printing, r.finish, ctx['rates']).items():
                totals[cur] += (value or 0) * r.quantity
        return Response({
            'currency': ctx['currency'], 'prices_updated_at': prices_updated_at(),
            'count': len(rows), 'total_quantity': sum(r.quantity for r in rows),
            'total_value': round(totals[ctx['currency']], 2), 'total_values': {k: round(v, 2) for k, v in totals.items()},
            'results': PublicItemSerializer(rows[offset:offset + limit], many=True, context=ctx).data,
        })


class MissingExportView(APIView):
    @extend_schema(request=MissingExportSerializer, responses=ExportResultSerializer)
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = MissingExportSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        rows = missing_rows(deck, d.get('filter') or {}, price_context(request), other_decks=d['other_decks'])
        lines = [f'{r.quantity} {r.printing.name} ({r.printing.set_id.upper()}) {r.printing.collector_number}' if d['printings']
                 else f'{r.quantity} {r.printing.name}' for r in rows]
        return Response({'text': ''.join(f'{line}\n' for line in lines), 'rows': len(lines)})


class PublicDeckListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id='users_decks_list', responses=DeckListSerializer)
    def get(self, request, username):
        user = get_object_or_404(get_user_model(), username__iexact=username)
        ctx = price_context(request)
        decks = Deck.objects.filter(user=user, is_public=True).select_related('location').order_by('name')
        return Response(DeckListSerializer({'currency': ctx['currency'],
                                            'decks': [build(d, ctx, detail=False) for d in decks]}).data)


class PublicDeckDetailView(APIView):
    """AC-28: everything but where your cards are. Private and missing decks look the same."""

    permission_classes = [AllowAny]

    @extend_schema(responses=DeckDetailSerializer)
    def get(self, request, username, pk):
        deck = Deck.objects.select_related('location', 'user').filter(
            pk=pk, user__username__iexact=username, is_public=True).first()
        if deck is None:
            raise Http404('Not found.')
        return Response(DeckDetailSerializer(build(deck, price_context(request), public=True)).data)


class OptimizeView(APIView):
    """Cheapest printings for the cards this deck lacks (spec 013)."""

    @extend_schema(responses=OptimizePreviewSerializer)
    def get(self, request, pk):
        deck = own_deck(request, pk)
        ctx = price_context(request)
        changes = cheapest_changes(deck, deck_cards(deck), ctx['currency'], ctx['rates'])
        return Response(OptimizePreviewSerializer({'changes': changes}).data)

    @extend_schema(request=OptimizeApplySerializer, responses=DeckDetailSerializer)
    def post(self, request, pk):
        deck = own_deck(request, pk)
        data = OptimizeApplySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        ctx = price_context(request)
        wanted = set(data.validated_data['cards'])
        with transaction.atomic():
            Deck.objects.select_for_update().get(pk=deck.pk)
            # Recomputed, so only cards that are still lacking and still cheaper change (AC-4, AC-6).
            for change in cheapest_changes(deck, deck_cards(deck), ctx['currency'], ctx['rates']):
                if change['card'] in wanted:
                    DeckCard.objects.filter(pk=change['card']).update(printing=change['cheapest'])
        return detail_response(request, deck)
