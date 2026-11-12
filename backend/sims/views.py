"""Pod simulation API (spec 024)."""

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from decks.models import Deck

from . import forge, replay, services
from .models import PoolDeck, SimGame, SimRun
from .serializers import (
    OpponentsSerializer, PodSerializer, PoolDeckRenameSerializer, PoolDeckWriteSerializer, QueueEntrySerializer,
    ReplaySerializer, RunPageSerializer, RunSerializer, SaveSwapsSerializer, SeatCheckSerializer, StartRunSerializer,
    StatusSerializer, SuggestionSerializer, art, row_data, run_data,
)

LIST_LIMIT = 50


class StatusView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=StatusSerializer)
    def get(self, request):
        return Response(StatusSerializer(forge.status()).data)


def opponent(obj, found) -> dict:
    if isinstance(obj, PoolDeck):
        names = services.commanders(obj.cards)
        return {'id': obj.id, 'source': 'pool', 'name': obj.name, 'commanders': names, 'image': art(next(iter(names), None), found),
                'owner': obj.added_by.username if obj.added_by else 'Forge', 'precon': obj.precon}
    names = [c.printing.name for c in obj.cards.all() if c.zone == 'commander']
    return {'id': obj.id, 'source': 'deck', 'name': obj.name, 'commanders': names, 'image': art(next(iter(names), None), found),
            'owner': obj.user.username, 'precon': False}


class OpponentsView(APIView):
    """Opponent pool, my decks and public decks, searchable by deck or commander name (AC-4)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[OpenApiParameter('q', str)], responses=OpponentsSerializer)
    def get(self, request):
        services.ensure_precons()
        q = request.query_params.get('q', '').strip()
        pool = PoolDeck.objects.select_related('added_by').order_by('precon', 'name')
        decks = services.commander_decks(Deck.objects.all()).select_related('user').prefetch_related('cards__printing').order_by('name')
        if q:
            pool = pool.filter(Q(name__icontains=q) | Q(cards__icontains=q))
            decks = decks.filter(Q(name__icontains=q) | Q(cards__zone='commander', cards__printing__name__icontains=q)).distinct()
        user = request.user
        mine = list(decks.filter(user=user)[:LIST_LIMIT]) if user.is_authenticated else []
        public = list((decks.exclude(user=user) if user.is_authenticated else decks).filter(is_public=True)[:LIST_LIMIT])
        pool = list(pool[:LIST_LIMIT])
        names = [n for p in pool for n in services.commanders(p.cards)] + [c.printing.name for d in mine + public for c in d.cards.all() if c.zone == 'commander']
        found = services.printings_by_name(names)
        return Response(OpponentsSerializer({
            'pool': [opponent(p, found) for p in pool],
            'mine': [opponent(d, found) for d in mine],
            'public': [opponent(d, found) for d in public],
        }).data)


class PoolView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PoolDeckWriteSerializer, responses=inline_serializer('PoolDeckCreated', {'id': serializers.IntegerField()}))
    def post(self, request):
        data = PoolDeckWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        if d.get('deck'):
            pool = services.pool_from_deck(request.user, services.visible_deck(request.user, d['deck']))
        else:
            pool = services.pool_from_text(request.user, d['name'].strip(), d['text'])
        return Response({'id': pool.id}, status=status.HTTP_201_CREATED)


class PoolDeckView(APIView):
    """Anyone can rename or remove any pool deck (AC-9)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PoolDeckRenameSerializer, responses={204: None})
    def patch(self, request, pk):
        data = PoolDeckRenameSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        pool = get_object_or_404(PoolDeck, pk=pk)
        pool.name = data.validated_data['name'].strip()
        pool.save(update_fields=['name'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        get_object_or_404(PoolDeck, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckView(APIView):
    """Unsupported cards of each seat (AC-11)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PodSerializer, responses=SeatCheckSerializer(many=True))
    def post(self, request):
        data = PodSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(SeatCheckSerializer(services.check_pod(request.user, data.validated_data['seats']), many=True).data)


class SwapsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=SaveSwapsSerializer, responses={204: None})
    def put(self, request):
        data = SaveSwapsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        services.save_swaps(request.user, {'deck': d.get('deck'), 'pool': d.get('pool')}, d['swaps'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SuggestView(APIView):
    """Forge-supported stand-ins for a card (AC-12)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[OpenApiParameter('name', str, required=True), OpenApiParameter('deck', int), OpenApiParameter('pool', int)],
                   responses=SuggestionSerializer(many=True))
    def get(self, request):
        spec = {'deck': int(request.query_params['deck'])} if request.query_params.get('deck') else {'pool': int(request.query_params.get('pool') or 0)}
        seat = services.seat_source(request.user, spec)
        colours = services.identity(seat['cards'])
        return Response(SuggestionSerializer(services.suggestions(request.query_params.get('name', ''), colours), many=True).data)


RUN_PAGE = 20


class RunsView(APIView):
    """Every run the user can see (spec 025, AC-6, AC-7, AC-10) and starting one (AC-3)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id='sims_runs_list', parameters=[OpenApiParameter('mine', bool), OpenApiParameter('q', str), OpenApiParameter('offset', int)],
                   responses=RunPageSerializer)
    def get(self, request):
        runs = services.visible_runs(request.user)
        if request.query_params.get('mine') in ('1', 'true'):
            runs = runs.filter(user=request.user)
        if q := request.query_params.get('q', '').strip():
            runs = runs.filter(search__icontains=q.lower())
        total = runs.count()
        offset = max(int(request.query_params.get('offset') or 0), 0)
        page = list(runs.select_related('user').prefetch_related(
            'seats', Prefetch('played', queryset=SimGame.objects.defer('replay')),
        ).order_by('-created_at', '-id')[offset:offset + RUN_PAGE])
        found = services.printings_by_name([n for r in page for s in r.seats.all() for n in services.commanders(s.cards)])
        return Response(RunPageSerializer({'results': [row_data(r, request.user, found) for r in page], 'total': total}).data)

    @extend_schema(request=StartRunSerializer, responses={201: RunSerializer})
    def post(self, request):
        data = StartRunSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        run = services.start_run(request.user, d['seats'], d['games'], d['minutes'], d['seat_mode'], d.get('order'))
        return Response(RunSerializer(run_data(run, request.user)).data, status=status.HTTP_201_CREATED)


class QueueView(APIView):
    """The run playing and the queued ones, in order (spec 024 AC-14, spec 025 AC-11)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=QueueEntrySerializer(many=True))
    def get(self, request):
        user = request.user
        runs = (SimRun.objects.filter(status__in=[SimRun.Status.PLAYING, SimRun.Status.QUEUED])
                .select_related('user').prefetch_related('seats').order_by('created_at'))
        visible = set(services.visible_runs(user).filter(pk__in=[r.pk for r in runs]).values_list('pk', flat=True))
        return Response(QueueEntrySerializer([{
            'id': r.id, 'deck_name': r.seats.all()[0].label if r.id in visible and r.seats.all() else 'Private deck',
            'user': r.user.username, 'mine': r.user_id == user.id, 'visible': r.id in visible,
            'can_cancel': services.can_cancel(user, r), 'status': r.status, 'played': r.played.count(), 'games': r.games,
        } for r in sorted(runs, key=lambda r: (r.status != SimRun.Status.PLAYING, r.created_at))], many=True).data)


class CancelAllView(APIView):
    """Admins stop the playing run and cancel every queued one (spec 025, AC-14)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=inline_serializer('CancelledAll', {'cancelled': serializers.IntegerField()}))
    def post(self, request):
        return Response({'cancelled': services.cancel_all(request.user)})


class RunView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=RunSerializer)
    def get(self, request, pk):
        return Response(RunSerializer(run_data(services.visible_run(request.user, pk), request.user)).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        if not request.user.is_authenticated:
            raise NotFound()
        services.delete_run(request.user, services.visible_run(request.user, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class CancelRunView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=RunSerializer)
    def post(self, request, pk):
        run = services.cancel_run(request.user, services.visible_run(request.user, pk))
        return Response(RunSerializer(run_data(run, request.user)).data)


class ReplayView(APIView):
    """One game, turn by turn (AC-23 to AC-28)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=ReplaySerializer)
    def get(self, request, pk, number):
        run = services.visible_run(request.user, pk)
        game = get_object_or_404(SimGame.objects.filter(run=run), number=number)
        return Response(ReplaySerializer({'run': run_data(run, request.user), **replay.build(game)}).data)
